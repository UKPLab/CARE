/**
 * Unit tests for redactPersonalData (utils/helper/personalData.js).
 *
 * resolveHookPrompt runs this on the finished prompt string. The input can be
 * a LaTeX snippet, a PDF title-page line, or instructions with either of those
 * embedded. The helper does not look at a file type.
 *
 */

const {redactPersonalData} = require("../utils/helper/personalData.js");

const REDACTED = "[REDACTED]";

describe("redactPersonalData", () => {
    test("redacts student macros inside a prompt, not only in a raw tex file", () => {
        const prompt = [
            "You are a reviewer. Use only the submission below.",
            "\\author{Hoai An\\ Nguyen}",
            "\\matriculationno{2575892}",
            "\\supervisor{Prof. Dr. Iryna Gurevych}",
            "The author argues that chatbots help patients.",
        ].join("\n");

        const out = redactPersonalData(prompt);

        expect(out).toContain("You are a reviewer. Use only the submission below.");
        expect(out).toContain(`\\author{${REDACTED}}`);
        expect(out).toContain(`\\matriculationno{${REDACTED}}`);
        expect(out).toContain("\\supervisor{Prof. Dr. Iryna Gurevych}");
        expect(out).toContain("The author argues that chatbots help patients.");
        expect(out).not.toContain("Hoai");
        expect(out).not.toContain("Nguyen");
        expect(out).not.toContain("2575892");
    });

    test("redacts a Matrikelnummer label when the prompt has no LaTeX", () => {
        const prompt = [
            "Grade the title page.",
            "Matrikelnummer: 2575892",
            "Topic: Optimizing User Engagement",
        ].join("\n");

        const out = redactPersonalData(prompt);

        expect(out).toContain(`Matrikelnummer: ${REDACTED}`);
        expect(out).toContain("Topic: Optimizing User Engagement");
        expect(out).not.toContain("2575892");
    });

    test.each([
        ["Matrikel-Nr. 1234567", `Matrikel-Nr. ${REDACTED}`],
        ["Matr.-Nr.: 1234567", `Matr.-Nr.: ${REDACTED}`],
        ["Student ID: 9988776", `Student ID: ${REDACTED}`],
        ["matriculation number 42", `matriculation number ${REDACTED}`],
    ])("redacts the labelled id form %s", (line, expected) => {
        const prompt = `Summarise this page.\n${line}\nScore the argument, not the student.`;
        const out = redactPersonalData(prompt);

        expect(out).toContain(expected);
        expect(out).toContain("Summarise this page.");
        expect(out).toContain("Score the argument, not the student.");
        expect(out).not.toMatch(/\d/);
    });

    test("redacts studentID and birthplace macros", () => {
        const prompt = "Fields:\n\\studentID{1234567}\n\\birthplace{Darmstadt}";
        const out = redactPersonalData(prompt);

        expect(out).toBe(`Fields:\n\\studentID{${REDACTED}}\n\\birthplace{${REDACTED}}`);
    });

    test("redacts both sources when one prompt mixes a tex snippet and a title-page line", () => {
        const prompt = [
            "Compare the source and the title page.",
            "\\author{Max Mustermann}",
            "Matrikelnummer 2575892",
        ].join("\n");

        const out = redactPersonalData(prompt);

        expect(out).toContain(`\\author{${REDACTED}}`);
        expect(out).toContain(`Matrikelnummer ${REDACTED}`);
        expect(out).not.toContain("Mustermann");
        expect(out).not.toContain("2575892");
    });

    test("leaves a name in ordinary sentences and an unlabelled number", () => {
        const prompt = "Hoai An Nguyen cites three papers on page 12.";
        expect(redactPersonalData(prompt)).toBe(prompt);
    });

    test("leaves a macro definition and an empty argument", () => {
        const prompt = "\\renewcommand*{\\author}[1]{#1}\n\\author{}";
        expect(redactPersonalData(prompt)).toBe(prompt);
    });

    test("leaves BibTeX author fields", () => {
        const prompt = "@article{x, author = {Hoai An Nguyen}, year = {2025}}";
        expect(redactPersonalData(prompt)).toBe(prompt);
    });

    test("is stable when run again", () => {
        const once = redactPersonalData("\\author{Max Mustermann}\nMatrikelnummer: 2575892");
        expect(redactPersonalData(once)).toBe(once);
    });

    test("handles empty and non-string input", () => {
        expect(redactPersonalData("")).toBe("");
        expect(redactPersonalData(null)).toBe("");
    });
});
