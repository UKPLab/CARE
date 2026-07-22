/**
 * Unit tests for placeholder token parsing and replacement helpers.
 *
 * @author Mohammad Elwan
 */
const {
    PLACEHOLDER_TOKEN_REGEX,
    parseOptionsString,
    formatOptionsString,
    parsePlaceholderMatch,
    isPositiveIntegerOptionValue,
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
        expect(parsePlaceholderMatch(bracketMatch)).toEqual({
            baseKey: "link",
            index: 2,
            options: {},
        });

        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        const plainMatch = PLACEHOLDER_TOKEN_REGEX.exec("~username~");
        expect(parsePlaceholderMatch(plainMatch)).toEqual({
            baseKey: "username",
            index: null,
            options: {},
        });
    });

    test("parsePlaceholderMatch parses option braces", () => {
        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        const match = PLACEHOLDER_TOKEN_REGEX.exec("~pdfText[1]{characterLimit:5000}~");
        expect(parsePlaceholderMatch(match)).toEqual({
            baseKey: "pdfText",
            index: 1,
            options: { characterLimit: "5000" },
        });
    });

    test("parseOptionsString and formatOptionsString round-trip", () => {
        expect(parseOptionsString("characterLimit:5000,otherOpt:value")).toEqual({
            characterLimit: "5000",
            otherOpt: "value",
        });
        expect(formatOptionsString({ characterLimit: 5000 })).toBe("{characterLimit:5000}");
        expect(formatOptionsString({})).toBe("");
    });

    test("isPositiveIntegerOptionValue", () => {
        expect(isPositiveIntegerOptionValue("5000")).toBe(true);
        expect(isPositiveIntegerOptionValue("0")).toBe(false);
        expect(isPositiveIntegerOptionValue("abc")).toBe(false);
        expect(isPositiveIntegerOptionValue("")).toBe(false);
    });

    test("formatPlaceholderToken and tokenInnerText", () => {
        expect(formatPlaceholderToken("submissionFiles", 3)).toBe("~submissionFiles[3]~");
        expect(formatPlaceholderToken("pdfText", 1, { characterLimit: 5000 })).toBe(
            "~pdfText[1]{characterLimit:5000}~"
        );
        expect(tokenInnerText("submissionFiles", 3)).toBe("submissionFiles[3]");
    });

    test("getUsedIndexes returns sorted unique indexes", () => {
        const text = "Use ~submissionFiles[3]{characterLimit:100}~ and ~submissionFiles[1]~";
        expect(getUsedIndexes(text, "submissionFiles")).toEqual([1, 3]);
        expect(getUsedIndexes(text, "link")).toEqual([]);
    });

    test("getNextPlaceholderIndex uses max existing plus one", () => {
        const text = "~link[1]~ ~link[3]{characterLimit:100}~";
        expect(getNextPlaceholderIndex(text, "link")).toBe(4);
        expect(getNextPlaceholderIndex("", "link")).toBe(1);
    });

    test("countPlaceholdersByKey respects bracketOnly", () => {
        const text = "~link~ and ~link[2]~ and ~pdfText[1]{characterLimit:5000}~";
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
        const text = "~link[2]~ ok ~link[2]{characterLimit:100}~ and ~link[3]~";
        expect(getDuplicatePlaceholderIndexes(text)).toEqual([{ key: "link", index: 2 }]);
        expect(getDuplicatePlaceholderIndexes("~link~ ~link~")).toEqual([]);
    });

    test("formatDuplicatePlaceholderToken", () => {
        expect(formatDuplicatePlaceholderToken({ key: "link", index: 2 })).toBe("~link[2]~");
    });

    test("applyPlaceholderReplacements resolves values with options", () => {
        const text = "Hi ~username~, file ~submissionFiles[1]~, pdf ~pdfText[1]{characterLimit:5000}~";
        const resolved = applyPlaceholderReplacements(text, (baseKey, index, options) => {
            if (baseKey === "username") return "Ada";
            if (baseKey === "submissionFiles" && index === 1) return "PDF text";
            if (baseKey === "pdfText" && index === 1) {
                return options.characterLimit === "5000" ? "limited" : "full";
            }
            return undefined;
        });
        expect(resolved).toBe("Hi Ada, file PDF text, pdf limited");
    });
});
