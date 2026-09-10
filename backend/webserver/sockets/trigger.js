"use strict";
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const { queueStatusLabel } = require("../../utils/triggerQueueStatus");

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
     * @socketEvent triggerCreate
     * @param {Object} data The trigger payload (event, action, settings, configuration)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>} The created trigger
     */
    async createTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.triggers.createNotAllowed");
        }
        if (!data.triggerEventId) {
            throw new TranslatableError("errors.triggers.eventRequired");
        }
        if (!data.triggerActionId) {
            throw new TranslatableError("errors.triggers.actionRequired");
        }
        if (!data.name?.trim()) {
            throw new TranslatableError("errors.triggers.nameRequired");
        }

        const payload = {
            name: data.name,
            userId: this.userId,
            triggerEventId: data.triggerEventId,
            triggerActionId: data.triggerActionId,
            projectId: data.projectId,
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
     * @socketEvent triggerUpdate
     * @param {Object} data Must contain `id`; any other trigger fields are updated.
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>} The updated trigger
     */
    async updateTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.triggers.updateNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.idRequired");
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
     * @socketEvent triggerDelete
     * @param {Object} data Must contain `id`.
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async deleteTrigger(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.triggers.deleteNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.idRequired");
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
            throw new TranslatableError("errors.triggers.logsViewNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.queueItemIdRequired");
        }

        const item = await this.models["trigger_queue"].getById(data.id);
        if (!item) {
            throw new TranslatableError("errors.triggers.queueItemNotFound");
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
            statusLabel: queueStatusLabel(item.status),
        };
    }

    /**
     * Re-queue a failed or cancelled trigger execution for another run.
     *
     * @socketEvent triggerQueueRetry
     * @param {Object} data Must contain `id` (queue item id)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async retryQueueItem(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.triggers.retryNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.queueItemIdRequired");
        }

        return await this.server.triggers.retryQueueItem(data.id, options);
    }

    /**
     * Create a new execution from a completed trigger log.
     *
     * @socketEvent triggerQueueRerun
     * @param {Object} data Must contain `id` (queue item id)
     * @param {Object} options Holds the managed transaction
     * @returns {Promise<Object>}
     */
    async rerunQueueItem(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.triggers.rerunNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.queueItemIdRequired");
        }

        return await this.server.triggers.rerunQueueItem(data.id, options);
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
            throw new TranslatableError("errors.triggers.cancelNotAllowed");
        }
        if (!data.id) {
            throw new TranslatableError("errors.triggers.queueItemIdRequired");
        }

        return await this.server.triggers.cancelQueueItem(data.id, options);
    }

    init() {
        this.createSocket("triggerCreate", this.createTrigger, {}, true);
        this.createSocket("triggerUpdate", this.updateTrigger, {}, true);
        this.createSocket("triggerDelete", this.deleteTrigger, {}, true);
        this.createSocket("triggerQueueGetDetails", this.getQueueDetails, {}, false);
        this.createSocket("triggerQueueRetry", this.retryQueueItem, {}, false);
        this.createSocket("triggerQueueRerun", this.rerunQueueItem, {}, false);
        this.createSocket("triggerQueueCancel", this.cancelQueueItem, {}, true);
    }
}

module.exports = TriggerSocket;
