"use strict";
const Socket = require("../Socket.js");
const queueDashboard = require("../../db/config/triggerQueueDashboard.js");
const rulesDashboard = require("../../db/config/triggerRulesDashboard.js");

const { STATUS: QUEUE_STATUS, statusByValue: QUEUE_STATUS_BY_VALUE } = queueDashboard;

/**
 * Handle trigger rules through websocket.
 *
 * @type {TriggerSocket}
 * @class TriggerSocket
 */
class TriggerSocket extends Socket {
    /**
     * Create a new trigger rule.
     *
     * @param {Object} data The trigger payload (event, action, settings, configuration)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>} The created trigger
     */
    async createTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to create triggers.");
        }
        if (!data.triggerEventId) {
            throw new Error("An event is required.");
        }
        if (!data.triggerActionId) {
            throw new Error("An action is required.");
        }

        const payload = {
            name: data.name,
            userId: this.userId,
            triggerEventId: data.triggerEventId,
            triggerActionId: data.triggerActionId,
            projectId: data.projectId || null,
            parallelLimit: data.parallelLimit ?? 1,
            maxRetries: data.maxRetries ?? 3,
            timeout: data.timeout ?? 300,
            enabled: data.enabled ?? true,
            configuration: data.configuration || {},
        };

        return await this.models["trigger"].add(payload, { transaction: options.transaction });
    }

    /**
     * Update an existing trigger rule.
     *
     * @param {Object} data Must contain `id`; any other trigger fields are updated.
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>} The updated trigger
     */
    async updateTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to update triggers.");
        }
        if (!data.id) {
            throw new Error("A trigger id is required.");
        }

        const allowed = [
            "name", "triggerEventId", "triggerActionId", "projectId",
            "parallelLimit", "maxRetries", "timeout", "enabled", "configuration",
        ];
        const payload = {};
        for (const key of allowed) {
            if (key in data) {
                payload[key] = data[key];
            }
        }

        return await this.models["trigger"].updateById(data.id, payload, { transaction: options.transaction });
    }

    /**
     * Soft-delete a trigger rule.
     *
     * @param {Object} data Must contain `id`.
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async deleteTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to delete triggers.");
        }
        if (!data.id) {
            throw new Error("A trigger id is required.");
        }

        return await this.models["trigger"].deleteById(data.id, { transaction: options.transaction });
    }

    /**
     * Load a queue log entry with related trigger and catalog labels.
     *
     * @socketEvent triggerQueueGetDetails
     * @param {Object} data Must contain `id` (queue item id)
     * @returns {Promise<Object>}
     */
    async getQueueDetails(data) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to view trigger logs.");
        }
        if (!data.id) {
            throw new Error("A queue item id is required.");
        }

        const item = await this.models["trigger_queue"].getById(data.id);
        if (!item) {
            throw new Error("Queue item not found.");
        }

        const trigger = await this.models["trigger"].getById(item.triggerId, {}, true);
        let eventLabel = "-";
        let actionLabel = "-";
        if (trigger) {
            const event = await this.models["trigger_event"].getById(trigger.triggerEventId, {}, true);
            const action = await this.models["trigger_action"].getById(trigger.triggerActionId, {}, true);
            eventLabel = event?.configuration?.label || event?.name || "-";
            actionLabel = action?.configuration?.label || action?.name || "-";
        }

        return {
            item,
            trigger: trigger || null,
            eventLabel,
            actionLabel,
            statusLabel: this.#statusLabel(item.status),
        };
    }

    /**
     * Re-queue a failed trigger execution for another run.
     *
     * @socketEvent triggerQueueRetry
     * @param {Object} data Must contain `id` (queue item id)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async retryQueueItem(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to retry trigger logs.");
        }
        if (!data.id) {
            throw new Error("A queue item id is required.");
        }

        const item = await this.models["trigger_queue"].getById(data.id);
        if (!item) {
            throw new Error("Queue item not found.");
        }
        const failedStatus = QUEUE_STATUS.FAILED;
        if (item.status !== failedStatus) {
            throw new Error("Only failed queue items can be retried.");
        }

        const trigger = await this.models["trigger"].getById(item.triggerId, {}, true);
        if (!trigger) {
            throw new Error("Associated trigger rule not found.");
        }
        if (item.attemptCount >= trigger.maxRetries) {
            throw new Error("Maximum retries for this trigger have been reached.");
        }

        return await this.models["trigger_queue"].updateById(
            data.id,
            {
                status: QUEUE_STATUS.PENDING,
                errorMessage: null,
                startedAt: null,
                completedAt: null,
            },
            { transaction: options.transaction }
        );
    }

    /**
     * Cancel a pending or running trigger execution.
     *
     * @socketEvent triggerQueueCancel
     * @param {Object} data Must contain `id` (queue item id)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async cancelQueueItem(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to cancel trigger logs.");
        }
        if (!data.id) {
            throw new Error("A queue item id is required.");
        }

        const item = await this.models["trigger_queue"].getById(data.id);
        if (!item) {
            throw new Error("Queue item not found.");
        }

        const cancellable = [QUEUE_STATUS.PENDING, QUEUE_STATUS.RUNNING];
        if (!cancellable.includes(item.status)) {
            throw new Error("Only pending or running queue items can be cancelled.");
        }

        return await this.models["trigger_queue"].updateById(
            data.id,
            {
                status: QUEUE_STATUS.CANCELLED,
                completedAt: new Date(),
            },
            { transaction: options.transaction }
        );
    }

    #statusLabel(status) {
        return QUEUE_STATUS_BY_VALUE[status]?.label ?? String(status);
    }

    /**
     * @socketEvent triggerRulesGetDashboardConfig
     */
    async getRulesDashboardConfig() {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to view triggers.");
        }
        return rulesDashboard;
    }

    /**
     * @socketEvent triggerQueueGetDashboardConfig
     */
    async getQueueDashboardConfig() {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to view trigger logs.");
        }
        return queueDashboard;
    }

    init() {
        this.createSocket("triggerCreate", this.createTrigger, {}, true);
        this.createSocket("triggerUpdate", this.updateTrigger, {}, true);
        this.createSocket("triggerDelete", this.deleteTrigger, {}, true);
        this.createSocket("triggerRulesGetDashboardConfig", this.getRulesDashboardConfig, {}, false);
        this.createSocket("triggerQueueGetDashboardConfig", this.getQueueDashboardConfig, {}, false);
        this.createSocket("triggerQueueGetDetails", this.getQueueDetails, {}, false);
        this.createSocket("triggerQueueRetry", this.retryQueueItem, {}, true);
        this.createSocket("triggerQueueCancel", this.cancelQueueItem, {}, true);
    }
}

module.exports = TriggerSocket;
