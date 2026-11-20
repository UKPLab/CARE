"use strict";

const {positiveInt} = require("./positiveInt.js");

/**
 * Picked workflow steps as clean (workflowId, stepNumber) pairs; entries with an unusable
 * workflowId or stepNumber are dropped.
 * @param {*} steps client list of `{workflowId, stepNumber}`
 * @returns {Array<{workflowId: number, stepNumber: number}>} empty when `steps` is not an array
 */
function workflowStepPairs(steps) {
    return (Array.isArray(steps) ? steps : [])
        .map((step) => ({
            workflowId: positiveInt(step?.workflowId),
            stepNumber: positiveInt(step?.stepNumber),
        }))
        .filter((step) => step.workflowId && step.stepNumber);
}

module.exports = {workflowStepPairs};
