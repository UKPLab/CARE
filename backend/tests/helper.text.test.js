/**
 * Unit tests for anonymizeTexSource (utils/helper/text.js): blanks the student
 * identity fields (\author, \matriculationno) in TUDa exposé LaTeX before the
 * source reaches a model, independent of the actual name or number.
 *
 * Pure string helper, no database involved.
 *
 * @author Mohammed Rawhani
 */

const {anonymizeTexSource} = require("../utils/helper/text.js");

// Title block from a real TUDa exposé: escaped space in the name, a matriculation
// number, plus fields and content that must survive untouched.
const EXPOSE = String.raw`\anonymizetrue
\title{Optimizing User Engagement in Healthcare Chatbots}
\author{Hoai An\ Nguyen} % Vorname, Nachname
\supervisor{Prof. Dr. Iryna Gurevych}
\matriculationno{2575892} % Matrikelnummer
\institute{Ubiquitous Knowledge Processing Lab}
`;

// Matching keys off the command, not the value, so it must hold for any name or
// number: umlauts, a single token, hyphen and apostrophe forms.
const CASES = [
    {name: "Hoai An\\ Nguyen", number: "2575892"},
    {name: "Jörg Müller", number: "1234567"},
    {name: "Smith", number: "42"},
    {name: "Anne-Marie O'Brien", number: "9988776"},
];

describe("anonymizeTexSource", () => {
    const out = anonymizeTexSource(EXPOSE);

    test("removes the author name, including the escaped space form", () => {
        expect(out).not.toMatch(/Hoai/);
        expect(out).not.toMatch(/Nguyen/);
        expect(out).toContain("\\author{Anonymized}");
    });

    test("removes the matriculation number", () => {
        expect(out).not.toContain("2575892");
        expect(out).toContain("\\matriculationno{Anonymized}");
    });

    test("leaves non-identity fields and content untouched", () => {
        expect(out).toContain("Prof. Dr. Iryna Gurevych");
        expect(out).toContain("Ubiquitous Knowledge Processing Lab");
        expect(out).toContain("Optimizing User Engagement in Healthcare Chatbots");
    });

    for (const {name, number} of CASES) {
        test(`blanks any author and matriculation value: "${name}" / ${number}`, () => {
            const tex = `\\author{${name}}\n\\matriculationno{${number}}\n\\supervisor{Prof. Dr. X}`;
            const result = anonymizeTexSource(tex);
            expect(result).not.toContain(name);
            expect(result).not.toContain(number);
            expect(result).toContain("\\author{Anonymized}");
            expect(result).toContain("\\matriculationno{Anonymized}");
            expect(result).toContain("\\supervisor{Prof. Dr. X}");
        });
    }

    test("drops an optional signature argument on \\author", () => {
        expect(anonymizeTexSource("\\author[Mustermann]{Max Mustermann}"))
            .toBe("\\author{Anonymized}");
    });

    test("is idempotent", () => {
        expect(anonymizeTexSource(out)).toBe(out);
    });

    test("does not touch BibTeX author fields or plain text", () => {
        const bib = "@article{x, author = {Hoai An Nguyen}, year = {2025}}";
        expect(anonymizeTexSource(bib)).toBe(bib);
    });

    test("handles empty and non-string input", () => {
        expect(anonymizeTexSource("")).toBe("");
        expect(anonymizeTexSource(null)).toBe(null);
    });
});
