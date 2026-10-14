const TranslatableError = require("../TranslatableError");

// Identity-bearing title commands in the TUDa thesis/exposé template. Their
// arguments are the only student PII in the source; the template itself blinds
// these two in the compiled PDF via its \ifanonymize switch.
const TEX_IDENTITY_COMMANDS = ["author", "matriculationno"];

/**
 * Blank the student's identity fields in TUDa LaTeX source.
 *
 * Replaces the argument of \author and \matriculationno with "Anonymized",
 * mirroring what the template prints in the anonymized PDF. Keying off the
 * command (not the name text) catches the matriculation number and is immune to
 * how the name is spelled or escaped. Safe to run on non-matching text (no-op).
 *
 * @param {string} text - Raw .tex source
 * @returns {string} Source with identity fields blanked
 */
function anonymizeTexSource(text) {
    if (typeof text !== "string" || !text) return text;
    return TEX_IDENTITY_COMMANDS.reduce((acc, command) => {
        // Optional [..] (e.g. \author's signature) is dropped with the value.
        const pattern = new RegExp(`\\\\${command}\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\}`, "g");
        return acc.replace(pattern, `\\${command}{Anonymized}`);
    }, text);
}

/**
 * Get the start and end positions of exact text within whole text, along with prefix and suffix
 * @param {string} exactText - The text to find positions for
 * @param {string} wholeText - The complete text to search within
 * @returns {{start: number, end: number, prefix: string, suffix: string}} Object containing start, end, prefix and suffix
 * @throws {Error} If exact text is not found in whole text
 */
function getTextPositions(exactText, wholeText) {
    const start = wholeText.indexOf(exactText);
    if (start === -1) {
        throw new TranslatableError( "errors.documents.exactTextNotFound");
    }

    const end = start + exactText.length;

    // Use the same context length calculation as in anchoring types
    const contextLen = 32;
    const prefix = wholeText.slice(Math.max(0, start - contextLen), start);
    const suffix = wholeText.slice(end, Math.min(wholeText.length, end + contextLen));

    return { start, end, prefix, suffix };
}

module.exports = {
    getTextPositions,
    anonymizeTexSource,
};