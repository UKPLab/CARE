"use strict";

/**
 * @param {*} value
 * @returns {number|null} positive safe integer, or null if unusable
 */
function positiveInt(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Positive integer ids only, duplicates dropped, first-seen order kept.
 * @param {*} ids
 * @returns {number[]} empty when `ids` is not an array
 */
function uniquePositiveInts(ids) {
    if (!Array.isArray(ids)) {
        return [];
    }
    return [...new Set(ids.map((id) => positiveInt(id)).filter(Boolean))];
}

module.exports = {positiveInt, uniquePositiveInts};
