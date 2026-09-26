"use strict";

/**
 * @param {*} value
 * @returns {number|null} positive safe integer, or null if unusable
 */
function positiveInt(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

module.exports = {positiveInt};
