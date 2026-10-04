"use strict";

/**
 * Redacts student fields in text sent to a model.
 *
 * @module utils/helper/personalData
 */

const REDACTED = "[REDACTED]";

/** `\author`, `\matriculationno`, `\studentID`, and `\birthplace`, with a single `{argument}`. */
const STUDENT_MACROS = /\\(author|matriculationno|studentID|birthplace)\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g;

/** Digits after Matrikelnummer, Matrikel-Nr., Matr.-Nr., Student ID, or matriculation number. */
const LABELLED_STUDENT_ID = /(Matrikelnummer|Matrikel-Nr\.|Matr\.-Nr\.|Student\s+ID|matriculation number)(\s*[:.]?\s*)\d+/gi;

/**
 * Picks the id used to find a submission.
 *
 * `submissionId` wins. Otherwise `pdfDocumentId`, then `documentId`.
 *
 * @param {Object} input - Hook submission input.
 * @returns {{submissionId?: number, documentId?: number}} One id, or an empty object.
 */
function submissionReference(input) {
    const submissionId = Number(input?.submissionId);
    if (Number.isInteger(submissionId) && submissionId > 0) {
        return {submissionId};
    }
    const documentId = Number(input?.pdfDocumentId || input?.documentId);
    if (Number.isInteger(documentId) && documentId > 0) {
        return {documentId};
    }
    return {};
}

/**
 * Checks whether a macro match is a definition rather than a filled-in value.
 *
 * @param {string} text - Full source.
 * @param {number} index - Index of the macro's backslash.
 * @returns {boolean} True when `\newcommand`, `\renewcommand`, or `\NewDocumentCommand` sits just before it.
 */
function isMacroDefinition(text, index) {
    const prefix = text.slice(Math.max(0, index - 80), index);
    return /\\(?:re)?newcommand\s*\*?\s*\{?\s*$/.test(prefix)
        || /\\NewDocumentCommand\s*\{?\s*$/.test(prefix);
}

/**
 * Replaces the arguments of `\author`, `\matriculationno`, `\studentID`, and `\birthplace`.
 *
 * Commented-out calls are included. Definitions, arguments that contain `#`, and empty arguments are left as they are.
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
    const updated = text.replace(STUDENT_MACROS, (match, name, argument, offset) => {
        if (isMacroDefinition(text, offset) || argument.includes("#")) {
            return match;
        }
        const parts = argument.split(/\\and\b/).map((part) => part.trim()).filter(Boolean);
        if (parts.length === 0) {
            return match;
        }
        removed.push(...parts);
        const replacement = name === "author" ? author : other;
        return `\\${name}{${replacement}}`;
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
    submissionReference,
};
