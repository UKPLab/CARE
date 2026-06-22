'use strict';

/**
 * AI budget limit-type discriminator.
 *
 * Mirrors the integer-coded enum convention used by aiHookOutputModes,
 * document.docTypes, and study_step.stepTypes.
 *
 * Semantics:
 *   TOTAL       — single ceiling for everything in scope (default)
 *   PER_SESSION — ceiling per session (only meaningful when studyId or
 *                 studyStepId is the cap target)
 *   PER_USER    — ceiling per user (only meaningful when studyId or
 *                 studyStepId is the cap target)
 *
 * Caps on model / model_share / hook / hook_share are always TOTAL — the
 * CHECK constraint on ai_budget enforces this.
 */
const AI_BUDGET_LIMIT_TYPES = Object.freeze({
    TOTAL: 0,
    PER_SESSION: 1,
    PER_USER: 2,
});

const AI_BUDGET_LIMIT_TYPE_VALUES = Object.freeze(Object.values(AI_BUDGET_LIMIT_TYPES));

function normalizeAiBudgetLimitType(value) {
    const numericValue = Number(value);
    if (Number.isInteger(numericValue) && AI_BUDGET_LIMIT_TYPE_VALUES.includes(numericValue)) {
        return numericValue;
    }
    throw new Error("Invalid AI budget limit type");
}

module.exports = {
    AI_BUDGET_LIMIT_TYPES,
    normalizeAiBudgetLimitType,
};
