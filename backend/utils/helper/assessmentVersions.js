"use strict";

const TranslatableError = require("../TranslatableError");

/**
 * Shared by the criterion and rubric socket handlers (versioned assessments): request field readers
 * with identical validation, and the criterion loader / response shape.
 * Only what the schema requires or what has a defined meaning is checked; nothing else is restricted.
 */

/** Right that opens the Assessment Management Dashboard (migration 20261031120000-add-assessments-nav). */
const DASHBOARD_RIGHT = "frontend.dashboard.assessments.view";

/** varchar(255) columns */
const MAX_STRING = 255;

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** @returns {boolean} finite number, or a plain decimal string (NUMERIC values come back from pg as strings) */
const isNumeric = (value) =>
    (typeof value === "number" && Number.isFinite(value))
    || (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim()));

/** NUMERIC column value (string from pg) → JSON number; null stays null. */
const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

const required = (field) => new TranslatableError("errors.assessment.fieldRequired", {field});
const invalid = (field) => new TranslatableError("errors.assessment.fieldInvalid", {field});

/**
 * Manually entered version number: string or number, trimmed, not empty, at most 255 characters.
 * @param {Object} source
 * @returns {string}
 * @throws {TranslatableError}
 */
function readVersionNumber(source) {
    let value = source.versionNumber;
    if (typeof value === "number" && Number.isFinite(value)) {
        value = String(value);
    }
    if (value === undefined || value === null) {
        throw required("versionNumber");
    }
    if (typeof value !== "string" || value.trim().length > MAX_STRING) {
        throw invalid("versionNumber");
    }
    value = value.trim();
    if (value === "") {
        throw required("versionNumber");
    }
    return value;
}

/**
 * Required string field.
 * @param {Object} source
 * @param {string} field
 * @param {{allowEmpty?: boolean, maxLength?: number}} [rules] blank is rejected unless allowEmpty
 * @returns {string}
 * @throws {TranslatableError}
 */
function readText(source, field, {allowEmpty = false, maxLength = MAX_STRING} = {}) {
    const value = source[field];
    if (value === undefined || value === null) {
        throw required(field);
    }
    if (typeof value !== "string" || value.length > maxLength) {
        throw invalid(field);
    }
    if (!allowEmpty && value.trim() === "") {
        throw required(field);
    }
    return value;
}

/**
 * Optional string field.
 * @returns {string|null} null when absent
 */
function readOptionalText(source, field) {
    const value = source[field];
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== "string" || value.length > MAX_STRING) {
        throw invalid(field);
    }
    return value;
}

/**
 * Numeric field (negative values are valid). Strings keep their exact decimal text.
 * @param {Object} source
 * @param {string} field
 * @param {boolean} [isRequired=false]
 * @returns {number|string|null} null when absent and optional
 */
function readNumber(source, field, isRequired = false) {
    const value = source[field];
    if (value === undefined || value === null) {
        if (isRequired) {
            throw required(field);
        }
        return null;
    }
    if (!isNumeric(value)) {
        throw invalid(field);
    }
    return typeof value === "string" ? value.trim() : value;
}

/**
 * `minPoints <= maxPoints` when both are set.
 * @throws {TranslatableError}
 */
function assertPointsRange(minPoints, maxPoints) {
    if (minPoints !== null && maxPoints !== null && Number(minPoints) > Number(maxPoints)) {
        throw new TranslatableError("errors.assessment.pointsRange");
    }
}

/** Criterion rows → API shape: plain numbers, options in order. */
function formatCriterion(row) {
    const plain = row.get({plain: true});
    return {
        ...plain,
        minPoints: toNumber(plain.minPoints),
        maxPoints: toNumber(plain.maxPoints),
        scoringOptions: plain.scoringOptions.map((option) => ({
            ...option,
            points: toNumber(option.points),
        })),
    };
}

/**
 * Criterion versions with their scoring options ordered by position.
 * @param {Object} models Sequelize models
 * @param {Object} where Sequelize where for `criterion`
 * @param {Object} [options] Sequelize options (transaction)
 * @returns {Promise<Object[]>}
 */
async function loadCriteria(models, where, options = {}) {
    const {criterion, criterion_scoring_option: scoringOption} = models;
    const rows = await criterion.findAll({
        where,
        include: [{model: scoringOption, as: "scoringOptions"}],
        order: [
            ["criterionGroupId", "ASC"],
            ["id", "ASC"],
            [{model: scoringOption, as: "scoringOptions"}, "position", "ASC"],
        ],
        transaction: options.transaction,
    });
    return rows.map(formatCriterion);
}

module.exports = {
    DASHBOARD_RIGHT,
    MAX_STRING,
    has,
    isObject,
    isNumeric,
    toNumber,
    readVersionNumber,
    readText,
    readOptionalText,
    readNumber,
    assertPointsRange,
    loadCriteria,
};
