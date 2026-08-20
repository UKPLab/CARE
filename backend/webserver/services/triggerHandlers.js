"use strict";

const { resolveTemplate } = require("../../utils/helper/templateResolver");
const {buildStudyHookKey} = require("../../utils/studyNlpDocumentData");
const { QUEUE_STATUS } = require("../../utils/triggerQueueStatus");
const { Op } = require("sequelize");
const aiHook = require("./ai/hook");

const HANDLERS = {
    send_email: sendEmail,
    nlp_preprocess: runAiPreprocessing,
};

const QUEUE_TABLE = "trigger_queue";
const executionQueues = new WeakMap();

const EVENT_CONTEXT_BUILDERS = {
    "submission.uploaded": buildSubmissionUploadContext,
};

/**
 * Convert JSONB/string/null configuration values into plain objects.
 *
 * @param {*} value The value to normalize
 * @returns {Object}
 */
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

/**
 * Build includes for trigger event/action catalog rows.
 *
 * @param {Object} models Sequelize models
 * @param {Object} eventWhere Additional event filter
 * @param {Object} actionWhere Additional action filter
 * @returns {Array<Object>}
 */
function triggerCatalogInclude(models, eventWhere = {}, actionWhere = {}) {
    return [
        { model: models["trigger_event"], as: "event", required: true, where: eventWhere },
        { model: models["trigger_action"], as: "action", required: true, where: actionWhere },
    ];
}

/**
 * Resolve event-specific context before trigger matching and execution.
 *
 * @param {Object} server CARE server instance
 * @param {string} eventName Trigger event name
 * @param {Object} context Event payload
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object>}
 */
async function buildEventContext(server, eventName, context, options = {}) {
    const builder = EVENT_CONTEXT_BUILDERS[eventName];
    return builder ? await builder(server, context, options) : { ...context };
}

/**
 * Enrich submission upload events with assignment, project, user, and label data.
 *
 * @param {Object} server CARE server instance
 * @param {Object} context Submission upload context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object>}
 */
async function buildSubmissionUploadContext(server, context, options = {}) {
    const models = server.db.models;
    const next = { ...context };

    if (next.submissionId && (next.assignmentId == null || next.userId == null)) {
        const submission = await models["submission"].getById(next.submissionId, { transaction: options.transaction });
        if (submission) {
            next.assignmentId = next.assignmentId ?? submission.assignmentId;
            next.userId = next.userId ?? submission.userId;
            next.timestamp = next.timestamp ?? submission.createdAt;
        }
    }

    if (next.assignmentId && (!next.assignmentName || next.projectId == null)) {
        const assignment = await models["assignment"].getById(next.assignmentId, { transaction: options.transaction });
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

/**
 * Check whether one trigger applies to the resolved event context.
 *
 * @param {Object} trigger Trigger row with event/action includes
 * @param {string} eventName Trigger event name
 * @param {Object} context Resolved event context
 * @returns {boolean}
 */
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

/**
 * Load enabled triggers whose event/action catalog entries match the event.
 *
 * @param {Object} server CARE server instance
 * @param {string} eventName Trigger event name
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Array<Object>>}
 */
async function findMatchingTriggers(server, eventName, context, options = {}) {
    const models = server.db.models;
    const triggers = await models["trigger"].findAll({
        where: { enabled: true, deleted: false },
        include: triggerCatalogInclude(
            models,
            { name: eventName, enabled: true, deleted: false },
            { enabled: true, deleted: false }
        ),
        raw: true,
        nest: true,
        transaction: options.transaction,
    });

    return triggers.filter((trigger) => matchesTrigger(trigger, eventName, context));
}

/**
 * Load a trigger with its event and action catalog rows.
 *
 * @param {Object} server CARE server instance
 * @param {number} triggerId Trigger id
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object|null>}
 */
async function getTriggerWithCatalog(server, triggerId, options = {}) {
    const models = server.db.models;
    return await models["trigger"].findOne({
        where: { id: triggerId, deleted: false },
        include: triggerCatalogInclude(models),
        raw: true,
        nest: true,
        transaction: options.transaction,
    });
}

/**
 * Create and broadcast a pending queue item for a trigger execution.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object|null>}
 */
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

/**
 * Update and broadcast a queue item.
 *
 * @param {Object} server CARE server instance
 * @param {Object} item Queue item
 * @param {Object} data Fields to update
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object|undefined>}
 */
async function updateQueueItem(server, item, data, options = {}) {
    if (!item) return;
    const updated = await server.db.models[QUEUE_TABLE].updateById(item.id, data, { transaction: options.transaction });
    await broadcastQueueItem(updated || { ...item, ...data }, options);
    return updated;
}

/**
 * Load a queue item by id.
 *
 * @param {Object} server CARE server instance
 * @param {number} queueItemId Queue item id
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object|undefined>}
 */
async function getQueueItem(server, queueItemId, options = {}) {
    return await server.db.models[QUEUE_TABLE].getById(queueItemId, { transaction: options.transaction });
}

/**
 * Check whether a queue item was cancelled after the current run started.
 *
 * @param {Object} server CARE server instance
 * @param {number} queueItemId Queue item id
 * @param {Object} options Trigger runtime options
 * @returns {Promise<boolean>}
 */
async function isQueueItemCancelled(server, queueItemId, options = {}) {
    const latest = await getQueueItem(server, queueItemId, options);
    return latest?.status === QUEUE_STATUS.CANCELLED;
}

/**
 * Notify subscribers about a queue item when a broadcaster is provided.
 *
 * @param {Object} item Queue item
 * @param {Object} options Trigger runtime options
 * @returns {Promise<void>}
 */
async function broadcastQueueItem(item, options = {}) {
    if (item && typeof options.broadcastQueueItem === "function") {
        await options.broadcastQueueItem(item);
    }
}

/**
 * Run queued work up to the trigger's configured parallel limit.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row
 * @param {Function} execute Work to run when a slot is available
 * @returns {Promise<*>} The work result
 */
function enqueueExecution(server, trigger, execute) {
    const limit = Number(trigger.parallelLimit ?? 1);
    if (!Number.isFinite(limit) || limit < 1) {
        return Promise.reject(new Error("Trigger parallel limit must be at least 1."));
    }

    let queues = executionQueues.get(server);
    if (!queues) {
        queues = new Map();
        executionQueues.set(server, queues);
    }

    let queue = queues.get(trigger.id);
    if (!queue) {
        queue = { running: 0, pending: [], limit };
        queues.set(trigger.id, queue);
    }
    queue.limit = limit;

    const drain = () => {
        while (queue.running < queue.limit && queue.pending.length) {
            const task = queue.pending.shift();
            queue.running += 1;
            Promise.resolve()
                .then(task.execute)
                .then(task.resolve, task.reject)
                .finally(() => {
                    queue.running -= 1;
                    if (!queue.running && !queue.pending.length) {
                        queues.delete(trigger.id);
                    } else {
                        drain();
                    }
                });
        }
    };

    return new Promise((resolve, reject) => {
        queue.pending.push({ execute, resolve, reject });
        drain();
    });
}

/**
 * Enqueue and execute a trigger for the current event.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<*>}
 */
async function runTrigger(server, trigger, context, options = {}) {
    const queueItem = await createQueueItem(server, trigger, context, options);
    return await enqueueExecution(
        server,
        trigger,
        () => runQueuedTrigger(server, trigger, queueItem, context, options)
    );
}

/**
 * Execute an existing queue item and update its lifecycle status.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row with action catalog data
 * @param {Object} queueItem Queue item to execute
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<*>}
 */
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

/**
 * Re-run a failed or cancelled queue item if retry limits allow it.
 *
 * @param {Object} server CARE server instance
 * @param {number} queueItemId Queue item id
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object>}
 */
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

    const [updatedCount] = await server.db.models[QUEUE_TABLE].update({
        status: QUEUE_STATUS.PENDING,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
    }, {
        where: { id: item.id, status: { [Op.in]: retryableStatuses } },
        transaction: options.transaction,
    });
    if (!updatedCount) {
        throw new Error("Queue item is already being retried.");
    }
    const pendingItem = await getQueueItem(server, item.id, options);
    await broadcastQueueItem(pendingItem, options);

    const eventContext = asObject(pendingItem.configuration).event || {};
    setImmediate(() => {
        enqueueExecution(
            server,
            trigger,
            () => runQueuedTrigger(server, trigger, pendingItem, eventContext, options)
        ).catch((err) => {
            server.logger.error(`Retry for trigger queue item ${pendingItem.id} failed: ${err.message}`, err);
        });
    });

    return pendingItem;
}

/**
 * Create a new execution from a completed queue item.
 *
 * The original queue item is kept unchanged so each manual re-run has its own
 * log entry and failed retry limits remain scoped to that new execution.
 *
 * @param {Object} server CARE server instance
 * @param {number} queueItemId Queue item id
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object>}
 */
async function rerunQueueItem(server, queueItemId, options = {}) {
    const item = await getQueueItem(server, queueItemId, options);
    if (!item) {
        throw new Error("Queue item not found.");
    }
    if (item.status !== QUEUE_STATUS.COMPLETED) {
        throw new Error("Only completed queue items can be re-run.");
    }

    const trigger = await getTriggerWithCatalog(server, item.triggerId, options);
    if (!trigger) {
        throw new Error("Associated trigger rule not found.");
    }

    const persistedConfig = asObject(item.configuration);
    const queueItem = await server.db.models[QUEUE_TABLE].add({
        triggerId: trigger.id,
        status: QUEUE_STATUS.PENDING,
        userId: item.userId || trigger.userId,
        configuration: {
            event: asObject(persistedConfig.event),
            action: asObject(persistedConfig.action),
        },
        errorMessage: null,
        attemptCount: 0,
        startedAt: null,
        completedAt: null,
    }, { transaction: options.transaction });

    await broadcastQueueItem(queueItem, options);

    setImmediate(() => {
        enqueueExecution(
            server,
            trigger,
            () => runQueuedTrigger(server, trigger, queueItem, asObject(persistedConfig.event), options)
        ).catch((err) => {
            server.logger.error(`Re-run for trigger queue item ${queueItem.id} failed: ${err.message}`, err);
        });
    });

    return queueItem;
}

/**
 * Handle any trigger event by resolving context, matching triggers, and running them.
 *
 * @param {Object} server CARE server instance
 * @param {string} eventName Trigger event name
 * @param {Object} context Event payload
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Array<*>>}
 */
async function handleTriggerEvent(server, eventName, context = {}, options = {}) {
    const eventContext = await buildEventContext(server, eventName, context, options);
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

/**
 * Handle submission upload events through the generic trigger runner.
 *
 * @param {Object} server CARE server instance
 * @param {Object} context Submission upload context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Array<*>>}
 */
async function handleSubmissionUploaded(server, context = {}, options = {}) {
    return await handleTriggerEvent(server, "submission.uploaded", context, options);
}

/**
 * Resolve configured email recipients for an email trigger action.
 *
 * @param {Object} server CARE server instance
 * @param {string} recipient Recipient selector
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Array<Object>>}
 */
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

/**
 * Send a templated email for a trigger action.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row with action configuration
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<Object>}
 */
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

/**
 * Convert NLP file mappings from context keys to concrete file ids.
 *
 * @param {Object} mappings Action parameter mappings
 * @param {Object} context Resolved event context
 * @returns {Object}
 */
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

function getConfiguredHookId(config) {
    const selected = config?.hookId
        ?? (config?.skillName?.startsWith("hook:") ? config.skillName.slice("hook:".length) : null);
    const hookId = Number(selected);
    return Number.isInteger(hookId) && hookId > 0 ? hookId : null;
}

/**
 * Execute an AI hook selected in an AI preprocessing trigger and persist its output.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row with action configuration
 * @param {Object} context Resolved event context
 * @returns {Promise<Object>}
 */
async function runAiHookTrigger(server, trigger, context) {
    const config = asObject(trigger.configuration).action || {};
    const hookId = getConfiguredHookId(config);
    const inputMappings = asObject(config.inputMappings);
    const baseMapping = inputMappings[config.baseFileParameter];
    const service = server.services["AIService"];
    if (!hookId || !baseMapping || !service) {
        throw new Error("AI hook trigger is not configured correctly.");
    }
    const hook = await server.db.models["ai_hook"].getById(hookId);
    if (!hook || hook.deleted || !hook.name) {
        throw new Error("AI hook trigger could not resolve its hook name.");
    }

    let documentId = Number(baseMapping.documentId || context.documentId);
    if (baseMapping.type === "submission") {
        const submission = await server.db.models["submission"].findByPk(context.submissionId, {raw: true});
        const baseType = asObject(config.baseFiles)[submission?.validationConfigurationId]
            || baseMapping.selectedFiles?.[0];
        const docTypes = server.db.models["document"].docTypes;
        const type = docTypes[`DOC_TYPE_${String(baseType).toUpperCase()}`] ?? docTypes.DOC_TYPE_ZIP;
        const document = await server.db.models["document"].findOne({
            where: {submissionId: context.submissionId, type, deleted: false},
            raw: true,
        });
        documentId = document?.id;
    }
    if (!documentId) {
        throw new Error("AI hook trigger could not resolve its result document.");
    }

    const values = {};
    for (const [placeholder, mapping] of Object.entries(inputMappings)) {
        if (placeholder === "output" || !mapping) continue;
        if (!["submission", "document", "configuration"].includes(mapping.type)) {
            throw new Error(`Unsupported AI hook input type "${mapping.type}".`);
        }
        values[placeholder] = {
            type: "serviceReplacement",
            input: {
                ...mapping,
                submissionId: mapping.submissionId || context.submissionId,
                documentId: mapping.documentId || documentId,
            },
        };
    }

    const userId = trigger.userId || context.userId;
    const result = await aiHook.runHook(service, { userId }, {
        hookId,
        values,
        documentId,
    });

    let value = result.outputText || "";
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch (_error) {
            // Keep non-JSON hook output as text.
        }
    }

    await server.db.models["document_data"].upsertData({
        userId,
        documentId,
        studySessionId: null,
        studyStepId: null,
        key: buildStudyHookKey("nlpRequest", hook.name),
        value,
    });

    return { ...result, documentId };
}

/**
 * Run the configured NLP preprocessing action through BackgroundTaskService.
 *
 * @param {Object} server CARE server instance
 * @param {Object} trigger Trigger row with action configuration
 * @param {Object} context Resolved event context
 * @param {Object} options Trigger runtime options
 * @returns {Promise<*>}
 */
async function runAiPreprocessing(server, trigger, context, options = {}) {
    const config = asObject(trigger.configuration).action || {};
    if (getConfiguredHookId(config)) {
        return await runAiHookTrigger(server, trigger, context);
    }

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
    rerunQueueItem,
    retryQueueItem,
    sendEmail,
    runAiPreprocessing,
    handlers: HANDLERS,
};
