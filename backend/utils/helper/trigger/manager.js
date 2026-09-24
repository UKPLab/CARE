"use strict";

const { QUEUE_STATUS } = require("../../triggerQueueStatus.js");
const {
    buildEventContext,
    findMatchingTriggers,
    getTriggerWithCatalog,
} = require("./context.js");
const triggerQueue = require("./queue.js");
const triggerHandlers = require("./handlers/index.js");

const TRIGGER_POLL_INTERVAL_MS = 1000;
const DEFAULT_TRIGGER_TIMEOUT_SECONDS = 300;

/**
 * Coordinates trigger events and processes persisted trigger jobs.
 */
class TriggerManager {
    /**
     * @param {Object} server CARE server.
     */
    constructor(server) {
        this.server = server;
        this.started = false;
        this.processing = false;
        this.processingScheduled = false;
        this.processRequested = false;
        this.pollTimer = null;
        this.activeExecutions = new Map();
        this.executionControllers = new Map();
        this.unsettledHandlers = new Map();
    }

    /**
     * Starts polling for pending trigger jobs.
     *
     * @returns {void}
     */
    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        this.pollTimer = setInterval(
            () => this.scheduleProcessing(),
            TRIGGER_POLL_INTERVAL_MS
        );
        this.pollTimer.unref?.();
        this.scheduleProcessing();
    }

    /**
     * Stops polling for trigger jobs.
     *
     * @returns {Promise<void>}
     */
    async close() {
        this.started = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        await Promise.allSettled(this.activeExecutions.values());
    }

    /**
     * Creates pending jobs for every trigger matching an event.
     *
     * @param {string} eventName Trigger event name.
     * @param {Object} context Event payload.
     * @param {Object} options Runtime options.
     * @returns {Promise<Array<Object>>} Created queue items.
     */
    async addEvent(eventName, context = {}, options = {}) {
        const eventContext = await buildEventContext(
            this.server,
            eventName,
            context,
            options
        );
        const triggers = await findMatchingTriggers(
            this.server,
            eventName,
            eventContext,
            options
        );
        const queueItems = [];

        for (const trigger of triggers) {
            queueItems.push(await triggerQueue.createQueueItem(
                this.server,
                trigger,
                eventContext,
                options
            ));
        }

        this.notifyAfterCommit(queueItems, options, true);
        return queueItems;
    }

    /**
     * Requeues a failed or cancelled trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async retryQueueItem(queueItemId, options = {}) {
        if (
            this.activeExecutions.has(Number(queueItemId))
            || this.unsettledHandlers.has(Number(queueItemId))
        ) {
            throw new Error("A running queue item cannot be retried.");
        }
        const queueItem = await triggerQueue.retryQueueItem(
            this.server,
            queueItemId,
            options
        );
        this.notifyAfterCommit([queueItem], options, true);
        return queueItem;
    }

    /**
     * Creates a new job from a completed trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async rerunQueueItem(queueItemId, options = {}) {
        const queueItem = await triggerQueue.rerunQueueItem(
            this.server,
            queueItemId,
            options
        );
        this.notifyAfterCommit([queueItem], options, true);
        return queueItem;
    }

    /**
     * Cancels a pending or running trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async cancelQueueItem(queueItemId, options = {}) {
        const queueItem = await triggerQueue.cancelQueueItem(
            this.server,
            queueItemId,
            options
        );
        const abortExecution = () => {
            this.executionControllers.get(Number(queueItemId))?.abort();
        };
        if (options.transaction && typeof options.transaction.afterCommit === "function") {
            options.transaction.afterCommit(abortExecution);
        } else {
            abortExecution();
        }
        this.notifyAfterCommit([queueItem], options, false);
        return queueItem;
    }

    /**
     * Schedules queue processing without overlapping worker loops.
     *
     * @returns {void}
     */
    scheduleProcessing() {
        if (!this.started) {
            return;
        }
        if (this.processing || this.processingScheduled) {
            this.processRequested = true;
            return;
        }

        this.processingScheduled = true;
        setImmediate(() => {
            this.processingScheduled = false;
            this.processPendingJobs().catch((error) => {
                this.server.logger.error(
                    `Trigger worker failed: ${error.message}`,
                    error
                );
            });
        });
    }

    /**
     * Claims and executes pending jobs while trigger capacity is available.
     *
     * @returns {Promise<void>}
     */
    async processPendingJobs() {
        if (this.processing || !this.started) {
            this.processRequested = true;
            return;
        }

        this.processing = true;
        this.processRequested = false;
        try {
            await this.recoverTimedOutQueueItems();
            const pendingItems = await triggerQueue.getPendingQueueItems(this.server);
            const triggerCache = new Map();

            for (const pendingItem of pendingItems) {
                let trigger = triggerCache.get(pendingItem.triggerId);
                if (trigger === undefined) {
                    trigger = await getTriggerWithCatalog(
                        this.server,
                        pendingItem.triggerId
                    );
                    triggerCache.set(pendingItem.triggerId, trigger || null);
                }

                const persistedConfig = pendingItem.configuration || {};
                const handlerName = persistedConfig.handler
                    || trigger?.action?.configuration?.handler
                    || null;
                const limit = Number(trigger?.parallelLimit ?? 1);
                const validLimit = Number.isFinite(limit) && limit >= 1;
                const claimedItem = await triggerQueue.claimQueueItem(
                    this.server,
                    pendingItem,
                    validLimit ? trigger : null,
                    handlerName
                );
                if (!claimedItem) {
                    continue;
                }
                await this.broadcastQueueItem(claimedItem);

                if (!trigger || !validLimit) {
                    const failedItem = await triggerQueue.finishQueueItem(
                        this.server,
                        claimedItem.id,
                        claimedItem.attemptCount,
                        {
                            status: QUEUE_STATUS.FAILED,
                            errorMessage: trigger
                                ? "Trigger parallel limit must be at least 1."
                                : "Associated trigger rule not found.",
                            completedAt: new Date(),
                        }
                    );
                    await this.broadcastQueueItem(failedItem);
                    continue;
                }

                this.launchExecution(trigger, claimedItem);
            }
        } finally {
            this.processing = false;
            if (this.processRequested) {
                this.processRequested = false;
                this.scheduleProcessing();
            }
        }
    }

    /**
     * Tracks one execution without blocking the queue polling loop.
     *
     * @param {Object} trigger Trigger with action catalog data.
     * @param {Object} queueItem Claimed queue item.
     * @returns {void}
     */
    launchExecution(trigger, queueItem) {
        const execution = this.runQueueItem(trigger, queueItem)
            .catch((error) => {
                this.server.logger.error(
                    `Trigger queue item ${queueItem.id} crashed: ${error.message}`,
                    error
                );
            })
            .finally(() => {
                this.activeExecutions.delete(Number(queueItem.id));
                this.scheduleProcessing();
            });
        this.activeExecutions.set(Number(queueItem.id), execution);
    }

    /**
     * Fails jobs whose worker disappeared or exceeded the configured timeout.
     *
     * @returns {Promise<void>}
     */
    async recoverTimedOutQueueItems() {
        const runningItems = await triggerQueue.getRunningQueueItems(this.server);
        const triggerCache = new Map();

        for (const queueItem of runningItems) {
            if (this.activeExecutions.has(Number(queueItem.id))) {
                continue;
            }
            let trigger = triggerCache.get(queueItem.triggerId);
            if (trigger === undefined) {
                trigger = await getTriggerWithCatalog(
                    this.server,
                    queueItem.triggerId
                );
                triggerCache.set(queueItem.triggerId, trigger || null);
            }

            const startedAt = new Date(queueItem.startedAt).getTime();
            if (
                Number.isFinite(startedAt)
                && Date.now() - startedAt < this.getTimeoutMilliseconds(trigger)
            ) {
                continue;
            }

            const failedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.FAILED,
                    errorMessage: "Trigger execution timed out.",
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(failedItem);
        }
    }

    /**
     * Converts a trigger timeout in seconds to milliseconds.
     *
     * @param {Object|null} trigger Trigger row.
     * @returns {number}
     */
    getTimeoutMilliseconds(trigger) {
        const timeoutSeconds = Number(
            trigger?.timeout ?? DEFAULT_TRIGGER_TIMEOUT_SECONDS
        );
        const normalizedTimeout = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
            ? timeoutSeconds
            : DEFAULT_TRIGGER_TIMEOUT_SECONDS;
        return normalizedTimeout * 1000;
    }

    /**
     * Runs one claimed queue item and records its final status.
     *
     * @param {Object} trigger Trigger with action catalog data.
     * @param {Object} queueItem Claimed queue item.
     * @returns {Promise<*>}
     */
    async runQueueItem(trigger, queueItem) {
        const persistedConfig = queueItem.configuration || {};
        const triggerConfig = trigger.configuration || {};
        const persistedActionConfig = persistedConfig.action || {};
        const executionTrigger = {
            ...trigger,
            configuration: {
                ...triggerConfig,
                action: Object.keys(persistedActionConfig).length
                    ? persistedActionConfig
                    : triggerConfig.action || {},
            },
        };
        const handlerName = persistedConfig.handler
            || trigger.action?.configuration?.handler;
        const handler = triggerHandlers[handlerName];

        try {
            if (!handler) {
                throw new Error(
                    `No trigger handler registered for ${handlerName}`
                );
            }

            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                return { cancelled: true };
            }

            const abortController = new AbortController();
            this.executionControllers.set(Number(queueItem.id), abortController);
            let timeoutId;
            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error("Trigger execution timed out."));
                }, this.getTimeoutMilliseconds(trigger));
                timeoutId.unref?.();
            });
            let result;
            try {
                const handlerPromise = Promise.resolve().then(() => handler(
                    this.server,
                    executionTrigger,
                    persistedConfig.event || {},
                    {
                        queueItemId: queueItem.id,
                        signal: abortController.signal,
                    }
                ));
                this.unsettledHandlers.set(Number(queueItem.id), handlerPromise);
                handlerPromise.then(
                    () => this.unsettledHandlers.delete(Number(queueItem.id)),
                    () => this.unsettledHandlers.delete(Number(queueItem.id))
                );
                result = await Promise.race([
                    handlerPromise,
                    timeout,
                ]);
            } finally {
                clearTimeout(timeoutId);
                this.executionControllers.delete(Number(queueItem.id));
            }

            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                await this.broadcastQueueItem(
                    await triggerQueue.getQueueItem(this.server, queueItem.id)
                );
                return { cancelled: true };
            }

            const completedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.COMPLETED,
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(completedItem);
            return result;
        } catch (error) {
            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                await this.broadcastQueueItem(
                    await triggerQueue.getQueueItem(this.server, queueItem.id)
                );
                return { cancelled: true };
            }

            const failedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.FAILED,
                    errorMessage: error.message || String(error),
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(failedItem);
            this.server.logger.error(
                `Trigger queue item ${queueItem.id} failed: ${error.message}`,
                error
            );
            return null;
        }
    }

    /**
     * Broadcasts committed queue changes and optionally starts the worker.
     *
     * @param {Array<Object>} queueItems Queue items to broadcast.
     * @param {Object} options Runtime options.
     * @param {boolean} shouldProcess Whether the worker should run afterward.
     * @returns {void}
     */
    notifyAfterCommit(queueItems, options, shouldProcess) {
        const notify = () => {
            setImmediate(async () => {
                try {
                    for (const queueItem of queueItems) {
                        await this.broadcastQueueItem(queueItem);
                    }
                } catch (error) {
                    this.server.logger.error(
                        `Failed to publish trigger queue changes: ${error.message}`,
                        error
                    );
                } finally {
                    if (shouldProcess) {
                        this.scheduleProcessing();
                    }
                }
            });
        };

        if (options.transaction && typeof options.transaction.afterCommit === "function") {
            options.transaction.afterCommit(notify);
        } else {
            notify();
        }
    }

    /**
     * Uses one connected socket to send an access-filtered table broadcast.
     *
     * @param {Object} queueItem Queue item.
     * @returns {Promise<void>}
     */
    async broadcastQueueItem(queueItem) {
        if (!queueItem) {
            return;
        }
        const triggerSockets = [];
        for (const socketMap of Object.values(this.server.availSockets)) {
            const triggerSocket = socketMap.TriggerSocket;
            if (!triggerSocket?.broadcastTable) {
                continue;
            }
            if (Number(triggerSocket.userId) === Number(queueItem.userId)) {
                await triggerSocket.broadcastTable("trigger_queue", [queueItem]);
                return;
            }
            triggerSockets.push(triggerSocket);
        }

        for (const triggerSocket of triggerSockets) {
            if (await triggerSocket.isAdmin()) {
                await triggerSocket.broadcastTable("trigger_queue", [queueItem]);
                return;
            }
        }
    }
}

module.exports = TriggerManager;
