/**
 * Unit tests for placeholder token parsing and replacement helpers.
 *
 * @author Mohammad Elwan
 */
const {
    PLACEHOLDER_TOKEN_REGEX,
    parseOptionsString,
    getDuplicateOptionNames,
    getTokensWithDuplicateOptions,
    formatOptionsString,
    parsePlaceholderMatch,
    isPositiveIntegerOptionValue,
    supportsRangeLimit,
    parsePositiveIntegerRange,
    isPositiveIntegerRangeOptionValue,
    formatPositiveIntegerRange,
    applyTextRangeLimit,
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
        const match = PLACEHOLDER_TOKEN_REGEX.exec("~pdfText[1]{wordRange:1-500}~");
        expect(parsePlaceholderMatch(match)).toEqual({
            baseKey: "pdfText",
            index: 1,
            options: { wordRange: "1-500" },
        });
    });

    test("parseOptionsString and formatOptionsString round-trip", () => {
        expect(parseOptionsString("wordRange:1-500,otherOpt:value")).toEqual({
            wordRange: "1-500",
            otherOpt: "value",
        });
        expect(formatOptionsString({ wordRange: "1-500" })).toBe("{wordRange:1-500}");
        expect(formatOptionsString({})).toBe("");
        expect(getDuplicateOptionNames("wordRange:1,wordRange:500")).toEqual(["wordRange"]);
        expect(getDuplicateOptionNames("wordRange:1,pageRange:2")).toEqual([]);
        expect(getTokensWithDuplicateOptions("~pdfText[1]{wordRange:1,wordRange:500}~")).toEqual([
            "~pdfText[1]{wordRange:1,wordRange:500}~",
        ]);
        expect(getTokensWithDuplicateOptions("~pdfText[1]{wordRange:1,pageRange:2}~")).toEqual([]);
    });

    test("isPositiveIntegerOptionValue", () => {
        expect(isPositiveIntegerOptionValue("5000")).toBe(true);
        expect(isPositiveIntegerOptionValue("0")).toBe(false);
        expect(isPositiveIntegerOptionValue("abc")).toBe(false);
        expect(isPositiveIntegerOptionValue("")).toBe(false);
    });

    test("parsePositiveIntegerRange treats a single number as first N", () => {
        expect(parsePositiveIntegerRange("500")).toEqual({ from: 1, to: 500 });
        expect(parsePositiveIntegerRange("2-4")).toEqual({ from: 2, to: 4 });
        expect(parsePositiveIntegerRange("2-2")).toEqual({ from: 2, to: 2 });
        expect(parsePositiveIntegerRange("4-2")).toBeNull();
        expect(parsePositiveIntegerRange("abc")).toBeNull();
        expect(isPositiveIntegerRangeOptionValue("1-500")).toBe(true);
    });

    test("formatPositiveIntegerRange", () => {
        expect(formatPositiveIntegerRange("", "500")).toBe("500");
        expect(formatPositiveIntegerRange("1", "500")).toBe("500");
        expect(formatPositiveIntegerRange("2", "4")).toBe("2-4");
        expect(formatPositiveIntegerRange("2", "")).toBe("2-2");
        expect(formatPositiveIntegerRange("4", "2")).toBe("");
    });

    test("supportsRangeLimit", () => {
        expect(supportsRangeLimit("pdfText")).toBe(true);
        expect(supportsRangeLimit("submissionFiles")).toBe(true);
        expect(supportsRangeLimit("editorText")).toBe(true);
        expect(supportsRangeLimit("studyContext")).toBe(false);
    });

    test("applyTextRangeLimit slices words and pages", () => {
        expect(applyTextRangeLimit("one two three four", { wordRange: "2" })).toBe("one two");
        expect(applyTextRangeLimit("one two three four", { wordRange: "2-3" })).toBe("two three");
        expect(applyTextRangeLimit(
            { pages: ["page one", "page two", "page three"], pageCount: 3 },
            { pageRange: "1" }
        )).toBe("page one");
        expect(applyTextRangeLimit(
            { pages: ["page one", "page two", "page three"], pageCount: 3 },
            { pageRange: "2-3" }
        )).toBe("page two\npage three");
        expect(applyTextRangeLimit("only page", { pageRange: "1" })).toBe("only page");
        expect(applyTextRangeLimit("only page", { pageRange: "2" })).toBe("only page");
        expect(applyTextRangeLimit("only page", { pageRange: "2-3" })).toBe("");
        expect(applyTextRangeLimit("one two three", {})).toBe("one two three");
    });

    test("applyTextRangeLimit wordRange alone starts at extract start; with pageRange it starts at those pages", () => {
        const pageWords = (prefix, count) => Array.from(
            { length: count },
            (_, i) => `${prefix}${i + 1}`
        ).join(" ");
        const firstWords = (text, count) => text.trim().split(/\s+/).slice(0, count).join(" ");

        const page1 = pageWords("a", 100);
        const page2 = pageWords("b", 600);
        const page3 = pageWords("c", 10);
        const doc = { pages: [page1, page2, page3], pageCount: 3 };

        expect(applyTextRangeLimit(doc, { wordRange: "500" })).toBe(
            firstWords(`${page1}\n${page2}\n${page3}`, 500)
        );
        expect(applyTextRangeLimit(doc, { pageRange: "2-2", wordRange: "500" })).toBe(
            firstWords(page2, 500)
        );
        expect(applyTextRangeLimit(doc, { wordRange: "500", pageRange: "2-2" })).toBe(
            firstWords(page2, 500)
        );

        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        const match = PLACEHOLDER_TOKEN_REGEX.exec("~pdfText[1]{wordRange:500,pageRange:2-2}~");
        expect(parsePlaceholderMatch(match).options).toEqual({
            wordRange: "500",
            pageRange: "2-2",
        });
        expect(applyTextRangeLimit(doc, parsePlaceholderMatch(match).options)).toBe(
            firstWords(page2, 500)
        );

        expect(applyTextRangeLimit(
            { pages: ["alpha beta gamma", "delta"], pageCount: 2 },
            { pageRange: "1", wordRange: "1-2" }
        )).toBe("alpha beta");
        expect(applyTextRangeLimit(doc, { pageRange: "3-3", wordRange: "500" })).toBe(page3);
        expect(applyTextRangeLimit("one two three", { wordRange: "500" })).toBe("one two three");
    });

    test("applyTextRangeLimit applies word from-to inside a page span", () => {
        const doc = {
            pages: ["a1 a2 a3 a4 a5", "b1 b2 b3 b4 b5", "c1 c2 c3 c4 c5"],
            pageCount: 3,
        };

        expect(applyTextRangeLimit(doc, { wordRange: "2-4" })).toBe("a2 a3 a4");
        expect(applyTextRangeLimit(doc, { pageRange: "2-2", wordRange: "2-4" })).toBe("b2 b3 b4");
        expect(applyTextRangeLimit(doc, { pageRange: "2-3", wordRange: "2-4" })).toBe("b2 b3 b4");
        expect(applyTextRangeLimit(doc, { pageRange: "2-3", wordRange: "4-8" })).toBe("b4 b5 c1 c2 c3");
        expect(applyTextRangeLimit(doc, { pageRange: "1-2", wordRange: "5-6" })).toBe("a5 b1");
        expect(applyTextRangeLimit(doc, { pageRange: "2-3", wordRange: "500" })).toBe(
            "b1 b2 b3 b4 b5 c1 c2 c3 c4 c5"
        );
        expect(applyTextRangeLimit(doc, { pageRange: "2-2", wordRange: "2-500" })).toBe("b2 b3 b4 b5");
        expect(applyTextRangeLimit(doc, { pageRange: "2", wordRange: "6" })).toBe("a1 a2 a3 a4 a5 b1");
        expect(applyTextRangeLimit(doc, { wordRange: "2-4", pageRange: "2-3" })).toBe("b2 b3 b4");
        expect(applyTextRangeLimit(doc, { pageRange: "2-3", wordRange: "20-30" })).toBe("");
        expect(applyTextRangeLimit(doc, { pageRange: "4-5", wordRange: "1-3" })).toBe("");
    });

    test("formatPlaceholderToken and tokenInnerText", () => {
        expect(formatPlaceholderToken("submissionFiles", 3)).toBe("~submissionFiles[3]~");
        expect(formatPlaceholderToken("pdfText", 1, { wordRange: "1-500" })).toBe(
            "~pdfText[1]{wordRange:1-500}~"
        );
        expect(tokenInnerText("submissionFiles", 3)).toBe("submissionFiles[3]");
    });

    test("getUsedIndexes returns sorted unique indexes", () => {
        const text = "Use ~submissionFiles[3]{wordRange:100}~ and ~submissionFiles[1]~";
        expect(getUsedIndexes(text, "submissionFiles")).toEqual([1, 3]);
        expect(getUsedIndexes(text, "link")).toEqual([]);
    });

    test("getNextPlaceholderIndex uses max existing plus one", () => {
        const text = "~link[1]~ ~link[3]{wordRange:100}~";
        expect(getNextPlaceholderIndex(text, "link")).toBe(4);
        expect(getNextPlaceholderIndex("", "link")).toBe(1);
    });

    test("countPlaceholdersByKey respects bracketOnly", () => {
        const text = "~link~ and ~link[2]~ and ~pdfText[1]{wordRange:1-500}~";
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
        const text = "~link[2]~ ok ~link[2]{wordRange:100}~ and ~link[3]~";
        expect(getDuplicatePlaceholderIndexes(text)).toEqual([{ key: "link", index: 2 }]);
        expect(getDuplicatePlaceholderIndexes("~link~ ~link~")).toEqual([]);
    });

    test("formatDuplicatePlaceholderToken", () => {
        expect(formatDuplicatePlaceholderToken({ key: "link", index: 2 })).toBe("~link[2]~");
    });

    test("applyPlaceholderReplacements resolves values with options", () => {
        const text = "Hi ~username~, file ~submissionFiles[1]~, pdf ~pdfText[1]{wordRange:500}~";
        const resolved = applyPlaceholderReplacements(text, (baseKey, index, options) => {
            if (baseKey === "username") return "Ada";
            if (baseKey === "submissionFiles" && index === 1) return "PDF text";
            if (baseKey === "pdfText" && index === 1) {
                return options.wordRange === "500" ? "limited" : "full";
            }
            return undefined;
        });
        expect(resolved).toBe("Hi Ada, file PDF text, pdf limited");
    });

    test("applyPlaceholderReplacements turns PDF page objects into text, not [object Object]", () => {
        const pages = { pages: ["intro", "methods"], pageCount: 2 };
        const resolved = applyPlaceholderReplacements("~pdfText[1]~", (_baseKey, _index, options) => {
            return applyTextRangeLimit(pages, options);
        });
        expect(resolved).toBe("intro\nmethods");
        expect(resolved).not.toContain("[object Object]");

        const sliced = applyPlaceholderReplacements(
            "~pdfText[1]{pageRange:1}~",
            (_baseKey, _index, options) => applyTextRangeLimit(pages, options)
        );
        expect(sliced).toBe("intro");
    });
});
