"use strict";

const TranslatableError = require("../TranslatableError");

/**
 * The three versioned entities. `table` and `group` are code constants (never user input); `lock` is the
 * namespace of the group's advisory lock, shared with the triggers of the database
 * (see 20261116024533-extend-assessment-version_chain.js).
 */
const ENTITIES = Object.freeze({
    assessment: Object.freeze({table: "assessment", group: "assessmentGroupId", lock: 1}),
    rubric: Object.freeze({table: "rubric", group: "rubricGroupId", lock: 2}),
    criterion: Object.freeze({table: "criterion", group: "criterionGroupId", lock: 3}),
});

/**
 * Shared by the criterion, rubric and assessment socket handlers (versioned assessments): request field readers
 * with identical validation, version numbering, settings validation, and the loaders / response shapes.
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
 * Version numbers are assigned by the backend ("1", "2", ...), never by the client. Every create and
 * create-version request is checked with this first: a `versionNumber` of any value, `null` included, is refused.
 * @param {Object} data request payload
 * @throws {TranslatableError} `errors.assessment.versionNumberNotAllowed`
 */
function rejectClientVersionNumber(data) {
    if (has(data, "versionNumber")) {
        throw new TranslatableError("errors.assessment.versionNumberNotAllowed");
    }
}

/**
 * Serialises the creators and deleters of one group (transaction-scoped advisory lock). Call it before the
 * version number is chosen and the row inserted; it is released with the transaction. The database triggers take
 * the same lock, so raw SQL is serialised too.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {"assessment"|"rubric"|"criterion"} kind
 * @param {number} groupId
 * @param {import("sequelize").Transaction} transaction
 */
async function lockVersionGroup(sequelize, kind, groupId, transaction) {
    await sequelize.query("SELECT pg_advisory_xact_lock(:namespace, :groupId)", {
        replacements: {namespace: ENTITIES[kind].lock, groupId}, transaction,
    });
}

/**
 * Next automatic version number of a group: one above the highest leading integer of every version label in
 * the group, deleted versions included, so a number is never handed out twice (1, 2, 3 with 3 deleted gives 4).
 * Older labels such as `1.2` count by their leading integer (1); labels without leading digits count as 0.
 * Nothing is renumbered. Call it after `lockVersionGroup`.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {"assessment"|"rubric"|"criterion"} kind
 * @param {number} groupId
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<string>}
 */
async function nextVersionNumber(sequelize, kind, groupId, transaction) {
    const {table, group} = ENTITIES[kind];
    const [row] = await sequelize.query(
        `SELECT (COALESCE(MAX(substring("versionNumber" from '^[0-9]+')::numeric), 0) + 1)::text AS "next"
         FROM "${table}" WHERE "${group}" = :groupId`,
        {replacements: {groupId}, transaction, type: sequelize.QueryTypes.SELECT});
    return row.next;
}

/**
 * Highest id of the live (not deleted) versions of a group: the "latest" version. Creation order, not the
 * label, decides, because older labels are not ordered.
 * @returns {Promise<number|null>}
 */
async function latestLiveVersionId(sequelize, kind, groupId, transaction) {
    const {table, group} = ENTITIES[kind];
    const [row] = await sequelize.query(
        `SELECT MAX(id) AS "latest" FROM "${table}" WHERE "${group}" = :groupId AND "deleted" = false`,
        {replacements: {groupId}, transaction, type: sequelize.QueryTypes.SELECT});
    return row.latest;
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

/** Limits of the Advanced Settings object. */
const SETTINGS_LIMITS = Object.freeze({maxEntries: 100, maxKeyLength: 255, maxStringLength: 10000});
/** Keys that must never be stored: they would let a settings object reach the prototype of other objects. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Validates an Advanced Settings object: a plain object of at most 100 entries; keys not empty after trimming,
 * at most 255 characters, not `__proto__`, `constructor` or `prototype`, unique after trimming; values string
 * (at most 10 000 characters), finite number or boolean (their JSON type is kept: the text "true" is not the
 * boolean true). No key has a special meaning or a fixed type. Keys are stored trimmed.
 * @param {*} raw value of the request
 * @returns {Object<string, string|number|boolean>} a new plain object
 * @throws {TranslatableError}
 */
function readSettings(raw) {
    if (!isObject(raw)) {
        throw new TranslatableError("errors.assessment.settingsInvalid", {max: SETTINGS_LIMITS.maxEntries});
    }
    const entries = Object.entries(raw);
    if (entries.length > SETTINGS_LIMITS.maxEntries) {
        throw new TranslatableError("errors.assessment.settingsInvalid", {max: SETTINGS_LIMITS.maxEntries});
    }
    const settings = {};
    for (const [rawKey, value] of entries) {
        const key = rawKey.trim();
        if (key === "" || key.length > SETTINGS_LIMITS.maxKeyLength || UNSAFE_KEYS.has(key)) {
            throw new TranslatableError("errors.assessment.settingsKeyInvalid", {key: rawKey});
        }
        if (Object.prototype.hasOwnProperty.call(settings, key)) {
            throw new TranslatableError("errors.assessment.settingsKeyDuplicate", {key});
        }
        const validType = typeof value === "string" ? value.length <= SETTINGS_LIMITS.maxStringLength
            : typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean";
        if (!validType) {
            throw new TranslatableError("errors.assessment.settingsValueInvalid", {key});
        }
        settings[key] = value;
    }
    return settings;
}

/**
 * Settings to store for a criterion request. `settings` replaces the whole object when sent (so a removed key
 * stays removed); without it the base (the copied version's settings) is the starting point.
 * @param {Object} source request fields
 * @param {Object} [base] settings to start from when the request carries none
 * @returns {Object}
 * @throws {TranslatableError}
 */
function readCriterionSettings(source, base = {}) {
    return readSettings(source.settings === undefined ? base : source.settings);
}

/** Criterion rows → API shape: plain numbers, options in order, settings as stored. */
function formatCriterion(row) {
    const plain = typeof row.get === "function" ? row.get({plain: true}) : row;
    return {
        ...plain,
        ...criterionFields(plain),
        scoringOptions: (plain.scoringOptions || []).map((option) => ({
            ...option,
            points: toNumber(option.points),
        })),
    };
}

/** Plain numbers and the settings of a criterion. */
function criterionFields(plain) {
    return {
        minPoints: toNumber(plain.minPoints),
        maxPoints: toNumber(plain.maxPoints),
        settings: plain.settings || {},
    };
}

/**
 * Live (not soft-deleted) criterion versions with their live scoring options ordered by position.
 * @param {Object} models Sequelize models
 * @param {Object} where Sequelize where for `criterion`
 * @param {Object} [options] Sequelize options (transaction)
 * @returns {Promise<Object[]>}
 */
async function loadCriteria(models, where, options = {}) {
    const {criterion, criterion_scoring_option: scoringOption} = models;
    const rows = await criterion.findAll({
        where: {...where, deleted: false},
        include: [{model: scoringOption, as: "scoringOptions", where: {deleted: false}, required: false}],
        order: [
            ["criterionGroupId", "ASC"],
            ["id", "ASC"],
            [{model: scoringOption, as: "scoringOptions"}, "position", "ASC"],
        ],
        transaction: options.transaction,
    });
    return rows.map(formatCriterion);
}

/**
 * Live rubric versions with their live criteria ordered by `criterionPositionInRubric`, API shape (plain numbers).
 * Each association is `{id, rubricId, criterionId, criterionPositionInRubric, criterion}`; `id` is the
 * criterion association id and `criterion` the full criterion version with its ordered scoring options.
 * Three queries however many rubrics: rubrics with their links, then all criteria with their options
 * (a deeper include would exceed PostgreSQL's 63 character alias limit).
 * @param {Object} models Sequelize models
 * @param {Object} where Sequelize where for `rubric`
 * @param {Object} [options] Sequelize options (transaction)
 * @returns {Promise<Object[]>}
 */
async function loadRubrics(models, where, options = {}) {
    const {rubric, rubric_criterion: rubricCriterion} = models;
    const rows = await rubric.findAll({
        where: {...where, deleted: false},
        include: [{model: rubricCriterion, as: "rubricCriteria", where: {deleted: false}, required: false}],
        order: [
            ["rubricGroupId", "ASC"],
            ["id", "ASC"],
            [{model: rubricCriterion, as: "rubricCriteria"}, "criterionPositionInRubric", "ASC"],
        ],
        transaction: options.transaction,
    });
    const plainRows = rows.map((row) => row.get({plain: true}));

    const criterionIds = [...new Set(plainRows.flatMap((row) => row.rubricCriteria.map((link) => link.criterionId)))];
    const criteria = criterionIds.length ? await loadCriteria(models, {id: criterionIds}, options) : [];
    const criterionById = new Map(criteria.map((criterion) => [criterion.id, criterion]));

    return plainRows.map(({rubricCriteria, ...plain}) => ({
        ...plain,
        minPoints: toNumber(plain.minPoints),
        maxPoints: toNumber(plain.maxPoints),
        defaultPoints: toNumber(plain.defaultPoints),
        criteria: rubricCriteria.map((link) => ({...link, criterion: criterionById.get(link.criterionId)})),
    }));
}

/**
 * The latest live version of every group, one query: the version row (no children) plus `versionCount`,
 * the number of live versions of its group. "Latest" is the highest id. Raw rows: callers format them.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {"assessment"|"rubric"|"criterion"} kind
 * @param {Object} [options] Sequelize options (transaction)
 * @returns {Promise<Object[]>} ordered by group id
 */
async function queryLatestVersions(sequelize, kind, options = {}) {
    const {table, group} = ENTITIES[kind];
    return await sequelize.query(
        `SELECT t.*, g."versionCount"
         FROM "${table}" t
         JOIN (SELECT "${group}" AS "groupId", MAX(id) AS "latestId", COUNT(*)::int AS "versionCount"
               FROM "${table}" WHERE "deleted" = false GROUP BY "${group}") g ON g."latestId" = t.id
         ORDER BY t."${group}"`,
        {transaction: options.transaction, type: sequelize.QueryTypes.SELECT});
}

/**
 * The live versions of one group, newest first, as short history rows (no children, no settings).
 * @param {import("sequelize").Sequelize} sequelize
 * @param {"assessment"|"rubric"|"criterion"} kind
 * @param {number} groupId
 * @param {Object} [options] Sequelize options (transaction)
 * @returns {Promise<{id: number, groupId: number, versionNumber: string, name: string, createdAt: Date}[]>}
 */
async function queryVersionHistory(sequelize, kind, groupId, options = {}) {
    const {table, group} = ENTITIES[kind];
    return await sequelize.query(
        `SELECT id, "${group}" AS "groupId", "versionNumber", name, "createdAt"
         FROM "${table}" WHERE "${group}" = :groupId AND "deleted" = false ORDER BY id DESC`,
        {replacements: {groupId}, transaction: options.transaction, type: sequelize.QueryTypes.SELECT});
}

module.exports = {
    ENTITIES,
    SETTINGS_LIMITS,
    rejectClientVersionNumber,
    lockVersionGroup,
    nextVersionNumber,
    latestLiveVersionId,
    readSettings,
    readCriterionSettings,
    criterionFields,
    queryLatestVersions,
    queryVersionHistory,
    DASHBOARD_RIGHT,
    MAX_STRING,
    has,
    isObject,
    isNumeric,
    toNumber,
    readText,
    readOptionalText,
    readNumber,
    assertPointsRange,
    loadCriteria,
    loadRubrics,
};
