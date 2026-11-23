const { normalizeAiHookOutputMode } = require("../../utils/aiHookOutputModes");
const TranslatableError = require("../../utils/TranslatableError");

describe("AI hook output-mode validation", () => {
    test.each([0, 1])("accepts supported mode %p", (value) => {
        expect(normalizeAiHookOutputMode(value)).toBe(value);
    });

    test.each([-1, 2, 0.5, "unsupported"])("rejects unsupported mode %p", (value) => {
        expect(() => normalizeAiHookOutputMode(value)).toThrow(TranslatableError);
        expect(() => normalizeAiHookOutputMode(value)).toThrow("errors.ai.hook.invalidOutputMode");
    });
});
