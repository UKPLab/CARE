'use strict';

const QUEUE_STATUS = Object.freeze({
    PENDING: 0,
    RUNNING: 1,
    COMPLETED: 2,
    CANCELLED: 3,
    FAILED: 4,
});

const QUEUE_STATUS_LABELS = Object.freeze({
    [QUEUE_STATUS.PENDING]: "Pending",
    [QUEUE_STATUS.RUNNING]: "Running",
    [QUEUE_STATUS.COMPLETED]: "Completed",
    [QUEUE_STATUS.CANCELLED]: "Cancelled",
    [QUEUE_STATUS.FAILED]: "Failed",
});

/**
 * Human-readable label for a trigger queue status integer.
 *
 * @param {number} status Queue status value
 * @returns {string}
 */
function queueStatusLabel(status) {
    return QUEUE_STATUS_LABELS[status] ?? String(status);
}

module.exports = {
    QUEUE_STATUS,
    queueStatusLabel,
};
