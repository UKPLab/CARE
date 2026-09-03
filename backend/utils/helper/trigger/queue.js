"use strict";

const { Op } = require("sequelize");
const { QUEUE_STATUS } = require("../../triggerQueueStatus.js");
const { getTriggerWithCatalog } = require("./context.js");

const QUEUE_TABLE = "trigger_queue";
const NLP_HANDLER = "nlp_preprocess";
// All workers use this PostgreSQL advisory lock before claiming the singleton NLP service.
const NLP_CLAIM_LOCK_ID = 73190421;

/**
 * Creates a pending queue item for one matched trigger.
 *
 * @param {Object} server CARE server.
 * @param {Object} trigger Matched trigger.
 * @param {Object} context Resolved event context.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 */
async function createQueueItem(server, trigger, context, options = {}) {
    return await server.db.models[QUEUE_TABLE].add({
        triggerId: trigger.id,
        status: QUEUE_STATUS.PENDING,
        userId: trigger.userId,
        configuration: {
            event: context,
            action: trigger.configuration?.action || {},
            handler: trigger.action?.configuration?.handler || null,
        },
        errorMessage: null,
        attemptCount: 0,
        startedAt: null,
        completedAt: null,
    }, { transaction: options.transaction });
}

/**
 * Loads a queue item by id.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object|undefined>}
 */
async function getQueueItem(server, queueItemId, options = {}) {
    return await server.db.models[QUEUE_TABLE].getById(
        queueItemId,
        { transaction: options.transaction }
    );
}

/**
 * Loads pending jobs in FIFO order.
 *
 * @param {Object} server CARE server.
 * @returns {Promise<Array<Object>>}
 */
async function getPendingQueueItems(server) {
    return await server.db.models[QUEUE_TABLE].findAll({
        where: { status: QUEUE_STATUS.PENDING, deleted: false },
        order: [["createdAt", "ASC"], ["id", "ASC"]],
        raw: true,
    });
}

/**
 * Loads running jobs for timeout recovery.
 *
 * @param {Object} server CARE server.
 * @returns {Promise<Array<Object>>}
 */
async function getRunningQueueItems(server) {
    return await server.db.models[QUEUE_TABLE].findAll({
        where: { status: QUEUE_STATUS.RUNNING, deleted: false },
        raw: true,
    });
}

/**
 * Claims a pending item while enforcing per-trigger and global NLP capacity.
 *
 * @param {Object} server CARE server.
 * @param {Object} item Pending queue item.
 * @param {Object|null} trigger Trigger row.
 * @param {string|null} handlerName Persisted action handler.
 * @returns {Promise<Object|null>} Claimed item, or null when another worker claimed it.
 */
async function claimQueueItem(server, item, trigger = null, handlerName = null) {
    return await server.db.sequelize.transaction(async (transaction) => {
        const queueModel = server.db.models[QUEUE_TABLE];

        if (trigger) {
            await server.db.models["trigger"].findOne({
                attributes: ["id"],
                where: { id: trigger.id },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            const runningCount = await queueModel.count({
                where: {
                    triggerId: trigger.id,
                    status: QUEUE_STATUS.RUNNING,
                    deleted: false,
                },
                transaction,
            });
            if (runningCount >= Number(trigger.parallelLimit ?? 1)) {
                return null;
            }
        }

        if (handlerName === NLP_HANDLER) {
            await server.db.sequelize.query(
                "SELECT pg_advisory_xact_lock(:lockId)",
                { replacements: { lockId: NLP_CLAIM_LOCK_ID }, transaction }
            );
            const runningNlpJobs = await queueModel.findAll({
                attributes: ["configuration"],
                where: { status: QUEUE_STATUS.RUNNING, deleted: false },
                transaction,
                raw: true,
            });
            if (runningNlpJobs.some((job) => (
                job.configuration?.handler === NLP_HANDLER
            ))) {
                return null;
            }
        }

        const [updatedCount] = await queueModel.update({
            status: QUEUE_STATUS.RUNNING,
            attemptCount: Number(item.attemptCount || 0) + 1,
            startedAt: new Date(),
            completedAt: null,
            errorMessage: null,
        }, {
            where: {
                id: item.id,
                status: QUEUE_STATUS.PENDING,
                deleted: false,
            },
            transaction,
        });

        return updatedCount
            ? await getQueueItem(server, item.id, { transaction })
            : null;
    });
}

/**
 * Completes or fails an item only while it is still running.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @param {number} attemptCount Claimed attempt number.
 * @param {Object} data Completion fields.
 * @returns {Promise<Object|undefined>} Latest queue item.
 */
async function finishQueueItem(server, queueItemId, attemptCount, data) {
    await server.db.models[QUEUE_TABLE].update(data, {
        where: {
            id: queueItemId,
            status: QUEUE_STATUS.RUNNING,
            attemptCount,
            deleted: false,
        },
    });
    return await getQueueItem(server, queueItemId);
}

/**
 * Checks whether a queue item was cancelled during execution.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @returns {Promise<boolean>}
 */
async function isQueueItemCancelled(server, queueItemId) {
    const item = await getQueueItem(server, queueItemId);
    return item?.status === QUEUE_STATUS.CANCELLED;
}

/**
 * Requeues a failed or cancelled job when retry limits allow it.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 * @throws {Error} If the item cannot be retried.
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

    return await getQueueItem(server, item.id, options);
}

/**
 * Creates a new job from a completed queue item.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 * @throws {Error} If the item cannot be rerun.
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

    const persistedConfig = item.configuration || {};
    return await server.db.models[QUEUE_TABLE].add({
        triggerId: trigger.id,
        status: QUEUE_STATUS.PENDING,
        userId: item.userId || trigger.userId,
        configuration: {
            event: persistedConfig.event || {},
            action: persistedConfig.action || {},
            handler: persistedConfig.handler || null,
        },
        errorMessage: null,
        attemptCount: 0,
        startedAt: null,
        completedAt: null,
    }, { transaction: options.transaction });
}

/**
 * Cancels a pending or running queue item.
 *
 * @param {Object} server CARE server.
 * @param {number} queueItemId Queue item id.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 * @throws {Error} If the item cannot be cancelled.
 */
async function cancelQueueItem(server, queueItemId, options = {}) {
    const item = await getQueueItem(server, queueItemId, options);
    if (!item) {
        throw new Error("Queue item not found.");
    }

    const cancellableStatuses = [QUEUE_STATUS.PENDING, QUEUE_STATUS.RUNNING];
    if (!cancellableStatuses.includes(item.status)) {
        throw new Error("Only pending or running queue items can be cancelled.");
    }

    const [updatedCount] = await server.db.models[QUEUE_TABLE].update({
        status: QUEUE_STATUS.CANCELLED,
        completedAt: new Date(),
    }, {
        where: {
            id: queueItemId,
            status: { [Op.in]: cancellableStatuses },
            deleted: false,
        },
        transaction: options.transaction,
    });
    if (!updatedCount) {
        throw new Error("Queue item is no longer cancellable.");
    }

    return await getQueueItem(server, queueItemId, options);
}

module.exports = {
    createQueueItem,
    getQueueItem,
    getPendingQueueItems,
    getRunningQueueItems,
    claimQueueItem,
    finishQueueItem,
    isQueueItemCancelled,
    retryQueueItem,
    rerunQueueItem,
    cancelQueueItem,
};
