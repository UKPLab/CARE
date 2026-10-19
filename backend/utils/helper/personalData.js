"use strict";

/**
 * Redacts student fields in text sent to a model.
 *
 * @module utils/helper/personalData
 * @author Mohammad Elwan
 */

const REDACTED = "[REDACTED]";

/** `\author`, `\matriculationno`, `\studentID`, and `\birthplace`, including `\newcommand{\name}{value}`. */
const STUDENT_MACROS = /\\(author|matriculationno|studentID|birthplace)(\s*\})?\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g;

/** Digits after Matrikelnummer, Matrikelnr., Matrikel-Nr., Matr.-Nr., Student ID, or matriculation number. */
const LABELLED_STUDENT_ID = /(Matrikelnummer|Matrikel-?Nr\.|Matr\.-Nr\.|Student\s+ID|matriculation number)(\s*[:.]?\s*)\d+/gi;

/**
 * Replaces the arguments of `\author`, `\matriculationno`, `\studentID`, and `\birthplace`.
 *
 * Commented-out calls are included. Arguments that contain `#`, and empty arguments, are left as they are.
 *
 * @param {string} text - Prompt or LaTeX text.
 * @param {Object} [replacements] - Text written into the macros.
 * @param {string} [replacements.author=""] - Replacement for `\author`.
 * @param {string} [replacements.other=""] - Replacement for the other three macros.
 * @returns {{text: string, removed: string[]}} Updated text and the argument values that were removed.
 */
function replaceLatexMetadata(text, replacements = {}) {
    const author = replacements.author ?? "";
    const other = replacements.other ?? "";
    if (typeof text !== "string" || text.length === 0) {
        return {text: typeof text === "string" ? text : "", removed: []};
    }

    const removed = [];
    STUDENT_MACROS.lastIndex = 0;
    const updated = text.replace(STUDENT_MACROS, (match, name, closingBrace, argument) => {
        if (argument.includes("#")) {
            return match;
        }
        const parts = argument.split(/\\and\b/).map((part) => part.trim()).filter(Boolean);
        if (parts.length === 0) {
            return match;
        }
        removed.push(...parts);
        const replacement = name === "author" ? author : other;
        return `\\${name}${closingBrace || ""}{${replacement}}`;
    });
    return {text: updated, removed};
}

/**
 * Redacts student fields in a finished prompt.
 *
 * Macro arguments become `[REDACTED]`. Digits after a Matrikelnummer-style label do too.
 * A name in the PDF body is left as it is.
 *
 * @param {string} text - Prompt text.
 * @returns {string} Text with those fields replaced.
 */
function redactPersonalData(text) {
    if (typeof text !== "string" || text.length === 0) {
        return typeof text === "string" ? text : "";
    }
    const {text: withoutMacros} = replaceLatexMetadata(text, {
        author: REDACTED,
        other: REDACTED,
    });
    LABELLED_STUDENT_ID.lastIndex = 0;
    return withoutMacros.replace(LABELLED_STUDENT_ID, `$1$2${REDACTED}`);
}

module.exports = {
    REDACTED,
    redactPersonalData,
};
