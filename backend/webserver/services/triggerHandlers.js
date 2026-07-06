"use strict";

const { Op } = require("sequelize");
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

async function getTriggerWithCatalog(server, triggerId, options = {}) {
    const models = server.db.models;
    return await models["trigger"].findOne({
        where: { id: triggerId, deleted: false },
        include: [
            { model: models["trigger_event"], as: "event", required: true },
            { model: models["trigger_action"], as: "action", required: true },
        ],
        raw: true,
        nest: true,
        transaction: options.transaction,
    });
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

async function getQueueItem(server, queueItemId, options = {}) {
    return await server.db.models[QUEUE_TABLE].getById(queueItemId, { transaction: options.transaction });
}

async function isQueueItemCancelled(server, queueItemId, options = {}) {
    const latest = await getQueueItem(server, queueItemId, options);
    return latest?.status === QUEUE_STATUS.CANCELLED;
}

async function broadcastQueueItem(item, options = {}) {
    if (item && typeof options.broadcastQueueItem === "function") {
        await options.broadcastQueueItem(item);
    }
}

async function runTrigger(server, trigger, context, options = {}) {
    const queueItem = await createQueueItem(server, trigger, context, options);
    return await runQueuedTrigger(server, trigger, queueItem, context, options);
}

async function enforceParallelLimit(server, trigger, queueItem, options = {}) {
    const limit = Number(trigger.parallelLimit || 1);
    if (!Number.isFinite(limit) || limit < 1) {
        throw new Error("Trigger parallel limit must be at least 1.");
    }

    const runningCount = await server.db.models[QUEUE_TABLE].count({
        where: {
            triggerId: trigger.id,
            status: QUEUE_STATUS.RUNNING,
            id: { [Op.ne]: queueItem.id },
        },
        transaction: options.transaction,
    });

    if (runningCount >= limit) {
        throw new Error(`Trigger parallel limit reached (${limit}).`);
    }
}

async function runQueuedTrigger(server, trigger, queueItem, context, options = {}) {
    if (!queueItem) {
        throw new Error("Trigger execution requires a queue item.");
    }

    const persistedConfig = asObject(queueItem.configuration);
    const triggerConfig = asObject(trigger.configuration);
    const persistedActionConfig = asObject(persistedConfig.action);
    const executionTrigger = {
        ...trigger,
        configuration: {
            ...triggerConfig,
            action: Object.keys(persistedActionConfig).length ? persistedActionConfig : asObject(triggerConfig.action),
        },
    };
    const actionConfig = asObject(trigger.action && trigger.action.configuration);
    const handler = HANDLERS[actionConfig.handler];

    if (!handler) {
        throw new Error(`No trigger handler registered for ${actionConfig.handler}`);
    }

    const attemptCount = Number(queueItem.attemptCount || 0) + 1;

    await updateQueueItem(server, queueItem, {
        status: QUEUE_STATUS.RUNNING,
        attemptCount,
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
    }, options);

    try {
        await enforceParallelLimit(server, trigger, queueItem, options);

        const result = await handler(server, executionTrigger, context, { ...options, queueItemId: queueItem.id });
        if (await isQueueItemCancelled(server, queueItem.id, options)) {
            return { cancelled: true };
        }

        await updateQueueItem(server, queueItem, {
            status: QUEUE_STATUS.COMPLETED,
            completedAt: new Date(),
        }, options);
        return result;
    } catch (err) {
        if (await isQueueItemCancelled(server, queueItem.id, options)) {
            return { cancelled: true };
        }

        await updateQueueItem(server, queueItem, {
            status: QUEUE_STATUS.FAILED,
            errorMessage: err.message || String(err),
            completedAt: new Date(),
        }, options);
        throw err;
    }
}

async function retryQueueItem(server, queueItemId, options = {}) {
    const item = await getQueueItem(server, queueItemId, options);
    if (!item) {
        throw new Error("Queue item not found.");
    }

    const retryableStatuses = [QUEUE_STATUS.FAILED, QUEUE_STATUS.CANCELLED];
    if (!retryableStatuses.includes(item.status)) {
        throw new Error("Only failed or cancelled queue items can be retried.");
    }

    const trigger = await getTriggerWithCatalog(server, item.triggerId, options);
    if (!trigger) {
        throw new Error("Associated trigger rule not found.");
    }

    const retriesUsed = Math.max(0, Number(item.attemptCount || 0) - 1);
    if (retriesUsed >= Number(trigger.maxRetries || 0)) {
        throw new Error("Maximum retries for this trigger have been reached.");
    }

    const pendingItem = await updateQueueItem(server, item, {
        status: QUEUE_STATUS.PENDING,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
    }, options);

    const eventContext = asObject(pendingItem.configuration).event || {};
    setImmediate(() => {
        runQueuedTrigger(server, trigger, pendingItem, eventContext, options).catch((err) => {
            server.logger.error(`Retry for trigger queue item ${pendingItem.id} failed: ${err.message}`, err);
        });
    });

    return pendingItem;
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

    if (recipient !== "uploader") {
        throw new Error(`Unsupported email recipient "${recipient}".`);
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
    if (!recipients.length) {
        throw new Error("Email trigger action did not resolve any recipients.");
    }

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

async function runAiPreprocessing(server, trigger, context, options = {}) {
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
                failOnItemError: true,
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
    asObject,
    handleTriggerEvent,
    handleSubmissionUploaded,
    retryQueueItem,
    sendEmail,
    runAiPreprocessing,
    handlers: HANDLERS,
};
