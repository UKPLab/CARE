"use strict";

const { resolveTemplate } = require("../../utils/templateResolver");

const QUEUE_STATUS = {
    PENDING: 0,
    RUNNING: 1,
    COMPLETED: 2,
    CANCELLED: 3,
    FAILED: 4,
};

const HANDLERS = {
    send_email: sendEmail,
    nlp_preprocess: runAiPreprocessing,
};

const QUEUE_TABLE = "trigger_queue";

function asObject(value) {
    if (!value) return {};
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch (err) {
            return {};
        }
    }
    return value;
}

async function buildSubmissionContext(server, context, options = {}) {
    const models = server.db.models;
    const next = { ...context };

    if (next.submissionId && (!next.assignmentId || !next.userId)) {
        const submission = await models["submission"].getById(next.submissionId, options);
        if (submission) {
            next.assignmentId = next.assignmentId ?? submission.assignmentId;
            next.userId = next.userId ?? submission.userId;
            next.timestamp = next.timestamp ?? submission.createdAt;
        }
    }

    if (next.assignmentId && (!next.assignmentName || !next.projectId)) {
        const assignment = await models["assignment"].getById(next.assignmentId, options);
        if (assignment) {
            next.assignmentName = next.assignmentName ?? assignment.name;
            next.projectId = next.projectId ?? assignment.projectId;
        }
    }

    const eventType = ["reupload", "reuploaded"].includes(next.eventType) ? "reuploaded" : "uploaded";
    next.eventType = eventType;
    next.eventLabelLower = eventType;
    next.eventLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1);

    if (next.timestamp instanceof Date) {
        next.timestamp = next.timestamp.toLocaleString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return next;
}

function matchesTrigger(trigger, eventName, context) {
    const event = trigger.event || {};
    const action = trigger.action || {};
    const config = asObject(trigger.configuration);
    const eventConfig = asObject(config.event);

    if (event.name !== eventName || event.enabled === false || event.deleted || action.enabled === false || action.deleted) return false;
    if (trigger.projectId && context.projectId && Number(trigger.projectId) !== Number(context.projectId)) return false;
    if (eventConfig.assignmentId && Number(eventConfig.assignmentId) !== Number(context.assignmentId)) return false;

    return true;
}

async function findMatchingTriggers(server, eventName, context, options = {}) {
    const models = server.db.models;
    const triggers = await models["trigger"].findAll({
        where: { enabled: true, deleted: false },
        include: [
            { model: models["trigger_event"], as: "event", required: true },
            { model: models["trigger_action"], as: "action", required: true },
        ],
        raw: true,
        nest: true,
        transaction: options.transaction,
    });

    return triggers.filter((trigger) => matchesTrigger(trigger, eventName, context));
}

async function createQueueItem(server, trigger, context, options = {}) {
    const model = server.db.models[QUEUE_TABLE];
    if (!model) return null;

    const item = await model.add({
        triggerId: trigger.id,
        status: QUEUE_STATUS.PENDING,
        userId: trigger.userId,
        configuration: { event: context, action: asObject(trigger.configuration).action || {} },
        errorMessage: null,
        attemptCount: 0,
        startedAt: null,
        completedAt: null,
    }, { transaction: options.transaction });

    await broadcastQueueItem(item, options);
    return item;
}

async function updateQueueItem(server, item, data, options = {}) {
    if (!item) return;
    const updated = await server.db.models[QUEUE_TABLE].updateById(item.id, data, { transaction: options.transaction });
    await broadcastQueueItem(updated || { ...item, ...data }, options);
    return updated;
}

async function broadcastQueueItem(item, options = {}) {
    if (item && typeof options.broadcastQueueItem === "function") {
        await options.broadcastQueueItem(item);
    }
}

async function runTrigger(server, trigger, context, options = {}) {
    const queueItem = await createQueueItem(server, trigger, context, options);
    const actionConfig = asObject(trigger.action && trigger.action.configuration);
    const handler = HANDLERS[actionConfig.handler];

    if (!handler) {
        throw new Error(`No trigger handler registered for ${actionConfig.handler}`);
    }

    await updateQueueItem(server, queueItem, {
        status: QUEUE_STATUS.RUNNING,
        startedAt: new Date(),
    }, options);

    try {
        const result = await handler(server, trigger, context, options);
        await updateQueueItem(server, queueItem, {
            status: QUEUE_STATUS.COMPLETED,
            completedAt: new Date(),
        }, options);
        return result;
    } catch (err) {
        await updateQueueItem(server, queueItem, {
            status: QUEUE_STATUS.FAILED,
            errorMessage: err.message,
            completedAt: new Date(),
        }, options);
        throw err;
    }
}

async function handleTriggerEvent(server, eventName, context = {}, options = {}) {
    const eventContext = await buildSubmissionContext(server, context, options);
    const triggers = await findMatchingTriggers(server, eventName, eventContext, options);
    const results = [];

    for (const trigger of triggers) {
        try {
            results.push(await runTrigger(server, trigger, eventContext, options));
        } catch (err) {
            server.logger.error(`Trigger ${trigger.id} failed: ${err.message}`, err);
        }
    }

    return results;
}

async function handleSubmissionUploaded(server, context = {}, options = {}) {
    return await handleTriggerEvent(server, "submission.uploaded", context, options);
}

async function resolveEmailRecipients(server, recipient, context, options = {}) {
    const models = server.db.models;

    if (recipient === "admins") {
        return (await models["user"].getUsersByRole("admin") || []).filter((user) => user.email);
    }

    const userId = context.userId || context.submitterUserId;
    if (!userId) return [];

    const user = await models["user"].getById(userId, options);
    return user && user.email ? [user] : [];
}

async function sendEmail(server, trigger, context, options = {}) {
    const config = asObject(trigger.configuration).action || {};
    const templateId = config.templateId;

    if (!templateId) {
        throw new Error("Email trigger action requires templateId.");
    }

    const template = await server.db.models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Email template ${templateId} not found.`);
    }

    const recipients = await resolveEmailRecipients(server, config.recipient, context, options);
    const sent = [];

    for (const recipient of recipients) {
        const body = await resolveTemplate(templateId, { ...context, userId: recipient.id }, server.db.models, options);
        await server.sendMail(recipient.email, template.name, body, { isHtml: true });
        sent.push(recipient.email);
    }

    return { sent };
}

function hydrateSkillParameterMappings(mappings, context) {
    const hydrated = {};

    for (const [paramName, mapping] of Object.entries(mappings || {})) {
        if (Array.isArray(mapping.fileIds) && mapping.fileIds.length) {
            hydrated[paramName] = mapping;
            continue;
        }

        if (!mapping.fromContext) {
            throw new Error(`NLP parameter ${paramName} does not define fileIds or fromContext.`);
        }

        const fileId = context[mapping.fromContext];
        if (!fileId) {
            throw new Error(`NLP parameter ${paramName} could not resolve ${mapping.fromContext}.`);
        }

        hydrated[paramName] = {
            ...mapping,
            fileIds: [fileId],
        };
        delete hydrated[paramName].fromContext;
    }

    return hydrated;
}

async function runAiPreprocessing(server, trigger, context) {
    const config = asObject(trigger.configuration).action || {};
    const service = server.services["BackgroundTaskService"];

    if (!service) {
        throw new Error("BackgroundTaskService is not available.");
    }

    const socketId = `trigger:${trigger.id}:${Date.now()}`;
    const documentSocket = {
        userId: trigger.userId || context.userId,
        socket: {
            id: socketId,
            emit: async (event, payload) => {
                if (event !== "serviceRefresh" || payload.service !== "NLPService") {
                    return;
                }
                if (payload.type === "skillResults") {
                    await service.setResult(payload.data);
                }
                if (payload.type === "error" && typeof service.setError === "function") {
                    await service.setError(payload.data);
                }
            },
        },
        isAdmin: async () => true,
    };
    server.availSockets = server.availSockets || {};
    const previousSocket = server.availSockets[socketId];

    server.availSockets[socketId] = { DocumentSocket: documentSocket };

    try {
        return await service.startPreprocessing(
            { socket: { id: socketId } },
            {
                skillName: config.skillName,
                skillParameterMappings: hydrateSkillParameterMappings(config.skillParameterMappings, context),
                baseFileParameter: config.baseFileParameter,
                baseFiles: config.baseFiles,
            }
        );
    } finally {
        if (previousSocket) {
            server.availSockets[socketId] = previousSocket;
        } else {
            delete server.availSockets[socketId];
        }
    }
}

module.exports = {
    handleTriggerEvent,
    handleSubmissionUploaded,
    sendEmail,
    runAiPreprocessing,
    handlers: HANDLERS,
};
