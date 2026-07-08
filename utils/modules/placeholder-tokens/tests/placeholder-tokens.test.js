/**
 * Unit tests for placeholder token parsing and replacement helpers.
 *
 * @author Mohammad Elwan
 */
const {
    PLACEHOLDER_TOKEN_REGEX,
    parsePlaceholderMatch,
    formatPlaceholderToken,
    tokenInnerText,
    getUsedIndexes,
    getNextPlaceholderIndex,
    countPlaceholdersByKey,
    hasPlaceholderForKey,
    getDuplicatePlaceholderIndexes,
    formatDuplicatePlaceholderToken,
    applyPlaceholderReplacements,
} = require("../index");

describe("placeholder-tokens", () => {
    test("parsePlaceholderMatch parses bracket and unbracketed tokens", () => {
        const bracketMatch = PLACEHOLDER_TOKEN_REGEX.exec("~link[2]~");
        expect(parsePlaceholderMatch(bracketMatch)).toEqual({ baseKey: "link", index: 2 });

        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        const plainMatch = PLACEHOLDER_TOKEN_REGEX.exec("~username~");
        expect(parsePlaceholderMatch(plainMatch)).toEqual({ baseKey: "username", index: null });
    });

    test("formatPlaceholderToken and tokenInnerText", () => {
        expect(formatPlaceholderToken("submissionFiles", 3)).toBe("~submissionFiles[3]~");
        expect(tokenInnerText("submissionFiles", 3)).toBe("submissionFiles[3]");
    });

    test("getUsedIndexes returns sorted unique indexes", () => {
        const text = "Use ~submissionFiles[3]~ and ~submissionFiles[1]~ and ~submissionFiles[3]~";
        expect(getUsedIndexes(text, "submissionFiles")).toEqual([1, 3]);
        expect(getUsedIndexes(text, "link")).toEqual([]);
    });

    test("getNextPlaceholderIndex uses max existing plus one", () => {
        const text = "~link[1]~ ~link[3]~";
        expect(getNextPlaceholderIndex(text, "link")).toBe(4);
        expect(getNextPlaceholderIndex("", "link")).toBe(1);
    });

    test("countPlaceholdersByKey respects bracketOnly", () => {
        const text = "~link~ and ~link[2]~ and ~pdfText[1]~";
        expect(countPlaceholdersByKey(text)).toEqual({ link: 2, pdfText: 1 });
        expect(countPlaceholdersByKey(text, { bracketOnly: true })).toEqual({ link: 1, pdfText: 1 });
    });

    test("hasPlaceholderForKey supports bracketOnly", () => {
        const text = "~link[1]~";
        expect(hasPlaceholderForKey(text, "link")).toBe(true);
        expect(hasPlaceholderForKey("~link~", "link", { bracketOnly: true })).toBe(false);
        expect(hasPlaceholderForKey(text, "link", { bracketOnly: true })).toBe(true);
    });

    test("getDuplicatePlaceholderIndexes finds repeated bracket ids", () => {
        const text = "~link[2]~ ok ~link[2]~ and ~link[3]~";
        expect(getDuplicatePlaceholderIndexes(text)).toEqual([{ key: "link", index: 2 }]);
        expect(getDuplicatePlaceholderIndexes("~link~ ~link~")).toEqual([]);
    });

    test("formatDuplicatePlaceholderToken", () => {
        expect(formatDuplicatePlaceholderToken({ key: "link", index: 2 })).toBe("~link[2]~");
    });

    test("applyPlaceholderReplacements resolves values", () => {
        const text = "Hi ~username~, file ~submissionFiles[1]~";
        const resolved = applyPlaceholderReplacements(text, (baseKey, index) => {
            if (baseKey === "username") return "Ada";
            if (baseKey === "submissionFiles" && index === 1) return "PDF text";
            return undefined;
        });
        expect(resolved).toBe("Hi Ada, file PDF text");
    });
});
