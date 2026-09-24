"use strict";

const EVENT_CONTEXT_BUILDERS = {
    "submission.uploaded": buildSubmissionUploadContext,
};

/**
 * Builds Sequelize includes for trigger event and action catalog rows.
 *
 * @param {Object} models Sequelize models.
 * @param {Object} eventWhere Additional event filter.
 * @param {Object} actionWhere Additional action filter.
 * @returns {Array<Object>}
 */
function triggerCatalogInclude(models, eventWhere = {}, actionWhere = {}) {
    return [
        { model: models["trigger_event"], as: "event", required: true, where: eventWhere },
        { model: models["trigger_action"], as: "action", required: true, where: actionWhere },
    ];
}

/**
 * Resolves event-specific context before matching trigger rules.
 *
 * @param {Object} server CARE server.
 * @param {string} eventName Trigger event name.
 * @param {Object} context Event payload.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 */
async function buildEventContext(server, eventName, context, options = {}) {
    const builder = EVENT_CONTEXT_BUILDERS[eventName];
    return builder ? await builder(server, context, options) : { ...context };
}

/**
 * Adds assignment and upload metadata to a submission event.
 *
 * @param {Object} server CARE server.
 * @param {Object} context Submission upload context.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 */
async function buildSubmissionUploadContext(server, context, options = {}) {
    const models = server.db.models;
    const resolvedContext = { ...context };

    if (
        resolvedContext.submissionId
        && (resolvedContext.assignmentId == null || resolvedContext.userId == null)
    ) {
        const submission = await models["submission"].getById(
            resolvedContext.submissionId,
            { transaction: options.transaction }
        );
        if (submission) {
            resolvedContext.assignmentId = resolvedContext.assignmentId ?? submission.assignmentId;
            resolvedContext.userId = resolvedContext.userId ?? submission.userId;
            resolvedContext.timestamp = resolvedContext.timestamp ?? submission.createdAt;
        }
    }

    if (
        resolvedContext.assignmentId
        && (!resolvedContext.assignmentName || resolvedContext.projectId == null)
    ) {
        const assignment = await models["assignment"].getById(
            resolvedContext.assignmentId,
            { transaction: options.transaction }
        );
        if (assignment) {
            resolvedContext.assignmentName = resolvedContext.assignmentName ?? assignment.name;
            resolvedContext.projectId = resolvedContext.projectId ?? assignment.projectId;
        }
    }

    const eventType = ["reupload", "reuploaded"].includes(resolvedContext.eventType)
        ? "reuploaded"
        : "uploaded";
    resolvedContext.eventType = eventType;
    resolvedContext.eventLabelLower = eventType;
    resolvedContext.eventLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1);

    if (resolvedContext.timestamp instanceof Date) {
        resolvedContext.timestamp = resolvedContext.timestamp.toLocaleString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return resolvedContext;
}

/**
 * Checks whether a trigger rule applies to an event context.
 *
 * @param {Object} trigger Trigger row with catalog entries.
 * @param {string} eventName Trigger event name.
 * @param {Object} context Resolved event context.
 * @returns {boolean}
 */
function matchesTrigger(trigger, eventName, context) {
    const event = trigger.event || {};
    const action = trigger.action || {};
    const eventConfig = trigger.configuration?.event || {};

    if (
        event.name !== eventName
        || event.enabled === false
        || event.deleted
        || action.enabled === false
        || action.deleted
    ) {
        return false;
    }
    if (
        trigger.projectId
        && context.projectId
        && Number(trigger.projectId) !== Number(context.projectId)
    ) {
        return false;
    }
    if (
        eventConfig.assignmentId
        && Number(eventConfig.assignmentId) !== Number(context.assignmentId)
    ) {
        return false;
    }

    return true;
}

/**
 * Loads enabled triggers that match an event and its resolved context.
 *
 * @param {Object} server CARE server.
 * @param {string} eventName Trigger event name.
 * @param {Object} context Resolved event context.
 * @param {Object} options Runtime options.
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
 * Loads one trigger with its event and action catalog rows.
 *
 * @param {Object} server CARE server.
 * @param {number} triggerId Trigger id.
 * @param {Object} options Runtime options.
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

module.exports = {
    buildEventContext,
    findMatchingTriggers,
    getTriggerWithCatalog,
};
