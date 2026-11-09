"use strict";

/**
 * Redacts student fields in text sent to a model.
 *
 * @module utils/helper/personalData
 * @author Mohammad Elwan
 * @author Mohammed Rawhani
 */

const REDACTED = "[REDACTED]";
const {escapeRegExp} = require("lodash");

/** `\author`, `\matriculationno`, `\studentID`, and `\birthplace`, including `\newcommand{\name}{value}`. */
const STUDENT_MACROS = /\\(author|matriculationno|studentID|birthplace)(\s*\})?\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g;

/** Labelled student numbers, including abbreviated labels and digits separated by horizontal whitespace. */
const LABELLED_STUDENT_ID = /\b(Matrikelnummer|Mat(?:rikel|r)?\.?[ \t]*-?[ \t]*Nr\.?|Student\s+(?:ID|number)|matriculation number)(\s*[:.]?\s*)\d+(?:[^\S\r\n]+\d+)*/gi;

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
 * Known full names and adjacent 7–8-digit student numbers are also redacted.
 *
 * @param {string} text - Prompt text.
 * @param {string[]} [names=[]] - Known submission owners' full names (first and last together).
 * @returns {string} Text with those fields replaced.
 */
function redactPersonalData(text, names = []) {
    if (typeof text !== "string" || text.length === 0) {
        return typeof text === "string" ? text : "";
    }
    const {text: withoutMacros} = replaceLatexMetadata(text, {
        author: REDACTED,
        other: REDACTED,
    });
    LABELLED_STUDENT_ID.lastIndex = 0;
    const redacted = withoutMacros.replace(LABELLED_STUDENT_ID, `$1$2${REDACTED}`);
    const knownNames = [...new Set(names.map(name => name.trim()).filter(Boolean))]
        .sort((a, b) => b.length - a.length)
        .map(name => name.split(/\s+/).map(escapeRegExp).join("\\s+"));
    if (!knownNames.length) {
        return redacted;
    }
    const word = "[\\p{L}\\p{M}\\p{N}_]";
    const name = `(?<!${word})(?:${knownNames.join("|")})(?!${word})`;
    // Keep separators while removing an immediately adjacent student number on either side.
    const pattern = new RegExp(
        `(?:(?<!${word})(\\d{7,8})(\\s*[():,\\-]?\\s*))?${name}`
        + `(?:(\\s*[():,\\-]?\\s*)(\\d{7,8})(?!${word}))?`, "giu",
    );
    return redacted.replace(pattern, (match, before, beforeSeparator, afterSeparator, after) =>
        (before ? REDACTED + beforeSeparator : "") + REDACTED + (after ? afterSeparator + REDACTED : ""),
    );
}

module.exports = {
    REDACTED,
    redactPersonalData,
};
