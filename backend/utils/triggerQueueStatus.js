'use strict';

const QUEUE_STATUS = Object.freeze({
    PENDING: 0,
    RUNNING: 1,
    COMPLETED: 2,
    CANCELLED: 3,
    FAILED: 4,
});

module.exports = {
    QUEUE_STATUS,
};
