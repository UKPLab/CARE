'use strict';

const TranslatableError = require("./TranslatableError");

const AI_HOOK_OUTPUT_MODES = Object.freeze({
    TEXT: 0,
    JSON: 1,
});

const AI_HOOK_OUTPUT_MODE_VALUES = Object.freeze(Object.values(AI_HOOK_OUTPUT_MODES));

function normalizeAiHookOutputMode(value) {
    const numericValue = Number(value);
    if (Number.isInteger(numericValue) && AI_HOOK_OUTPUT_MODE_VALUES.includes(numericValue)) {
        return numericValue;
    }

    throw new TranslatableError("errors.ai.hook.invalidOutputMode");
}

module.exports = {
    AI_HOOK_OUTPUT_MODES,
    normalizeAiHookOutputMode,
};
