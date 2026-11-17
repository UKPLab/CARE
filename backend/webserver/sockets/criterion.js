"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {inUseParams, inUseUnknownParams} = require("../../utils/helper/assessmentReferenceLabels.js");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {
    DASHBOARD_RIGHT, has, isObject, isNumeric, rejectClientVersionNumber, readText, readNumber, assertPointsRange,
    readCriterionSettings, criterionFields, lockVersionGroup, nextVersionNumber,
    latestLiveVersionId, queryLatestVersions, queryVersionHistory, loadCriteria,
} = require("../../utils/helper/assessmentVersions.js");

/**
 * Socket handlers for criteria (`criterion`) and their scoring options (`criterion_scoring_option`).
 *
 * Criterion versions are immutable: there is no update event. A version and all its scoring options
 * are inserted in one transaction (database triggers reject rows added later); changes are made by
 * creating a new version, numbered automatically ("1", "2", ...). Deleting is a soft delete (the row and its
 * scoring options stay, flagged `deleted`), refused while a live rubric version uses the version. Everyone with
 * the dashboard right may use every event, whoever created the criterion. The six assessment models are not
 * autoTable, so nothing is broadcast; clients re-request.
 *
 * `settings` holds free key/value pairs without any special key.
 *
 * Every request payload must be an object (send `{}` when there is nothing to send).
 *
 * @class CriterionSocket
 */
class CriterionSocket extends Socket {

    /**
     * @throws {TranslatableError} when the user lacks the dashboard right
     */
    async assertDashboardAccess() {
        if (!(await this.hasAccess(DASHBOARD_RIGHT))) {
            throw new TranslatableError("errors.assessment.accessDenied");
        }
    }

    /**
     * Criterion versions with their scoring options ordered by position, API shape (plain numbers).
     * @param {Object} where Sequelize where for `criterion`
     * @param {Object} [options] Sequelize options (transaction)
     * @returns {Promise<Object[]>}
     */
    async loadCriteria(where, options = {}) {
        return await loadCriteria(this.models, where, options);
    }

    /**
     * Validates the criterion fields and scoring options of a create request. Only what the schema
     * requires or what has a defined meaning is checked; nothing else is restricted or defaulted.
     * @param {Object} source
     * @param {Object} [baseSettings] settings of the copied version, used when the request sends none
     * @returns {{fields: Object, scoringOptions: Object[]}} values ready to insert
     * @throws {TranslatableError}
     */
    validateCriterion(source, baseSettings = {}) {
        const fields = {
            name: readText(source, "name"),
            description: readText(source, "description", {allowEmpty: true, maxLength: Infinity}),
            minPoints: readNumber(source, "minPoints"),
            maxPoints: readNumber(source, "maxPoints"),
            settings: readCriterionSettings(source, baseSettings),
        };
        assertPointsRange(fields.minPoints, fields.maxPoints);

        const rawOptions = source.scoringOptions === undefined ? [] : source.scoringOptions;
        if (!Array.isArray(rawOptions)) {
            throw new TranslatableError("errors.assessment.fieldInvalid", {field: "scoringOptions"});
        }
        // The order of the array is the order of the options; positions are 1-based like the data
        // imported from the configurations.
        const scoringOptions = rawOptions.map((option, index) => {
            const optionError = (field) =>
                new TranslatableError("errors.assessment.optionInvalid", {position: index + 1, field});
            if (!isObject(option)) {
                throw optionError("option");
            }
            if (option.points === undefined || option.points === null || !isNumeric(option.points)) {
                throw optionError("points");
            }
            if (typeof option.description !== "string") {
                throw optionError("description");
            }
            return {
                points: typeof option.points === "string" ? option.points.trim() : option.points,
                description: option.description,
                position: index + 1,
            };
        });

        this.assertOptionsInRange(scoringOptions, fields.minPoints, fields.maxPoints);

        return {fields, scoringOptions};
    }

    /**
     * Every option's points must lie within the criterion's bounds: `minPoints <= points` when a minimum is
     * set, `points <= maxPoints` when a maximum is set, anything when neither is. Entered values are never
     * adjusted, an option outside the range is rejected.
     * @param {{points: number|string}[]} scoringOptions options in request order
     * @param {number|string|null} minPoints
     * @param {number|string|null} maxPoints
     * @throws {TranslatableError} optionBelowMin / optionAboveMax with the 1-based position of the option
     */
    assertOptionsInRange(scoringOptions, minPoints, maxPoints) {
        const low = minPoints === null ? null : Number(minPoints);
        const high = maxPoints === null ? null : Number(maxPoints);
        scoringOptions.forEach(({points}, index) => {
            const value = Number(points);
            if (low !== null && value < low) {
                throw new TranslatableError("errors.assessment.optionBelowMin", {position: index + 1, min: low});
            }
            if (high !== null && value > high) {
                throw new TranslatableError("errors.assessment.optionAboveMax", {position: index + 1, max: high});
            }
        });
    }

    /**
     * Inserts a criterion version and its scoring options in the caller's transaction. The version number is
     * assigned here (under the group lock): "1" for a new criterion, one above the highest number of the group otherwise.
     * @param {Object} source request fields (see validateCriterion)
     * @param {number|null} criterionGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @param {Object} [baseSettings] settings of the copied version
     * @returns {Promise<Object>} the stored criterion with its scoring options
     */
    async insertVersion(source, criterionGroupId, options, baseSettings = {}) {
        const {fields, scoringOptions} = this.validateCriterion(source, baseSettings);
        const {criterion, criterion_scoring_option: scoringOption} = this.models;
        const {sequelize} = this.server.db;
        const transaction = options.transaction;

        if (criterionGroupId !== null) {
            await lockVersionGroup(sequelize, "criterion", criterionGroupId, transaction);
        }
        const versionNumber = criterionGroupId === null
            ? "1" : await nextVersionNumber(sequelize, "criterion", criterionGroupId, transaction);

        let row;
        try {
            row = await criterion.create(
                criterionGroupId === null ? {...fields, versionNumber} : {...fields, versionNumber, criterionGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.versionConflict");
            }
            throw error;
        }
        if (scoringOptions.length) {
            await scoringOption.bulkCreate(
                scoringOptions.map((option) => ({...option, criterionId: row.id})),
                {transaction}
            );
        }
        const [stored] = await this.loadCriteria({id: row.id}, {transaction});
        return stored;
    }

    /**
     * All live criterion versions, including historical ones, ordered by group and id with their scoring options.
     * The dashboard table and the Versions modal use `criterionGetLatest` and `criterionGetVersions`; this full
     * list feeds the criterion version selection of the rubric modal.
     *
     * @socketEvent criterionGetAll
     * @param {Object} data {} (no filters)
     * @param {Object} options
     * @returns {Promise<Object[]>} criteria, each with `scoringOptions` ordered by `position`
     */
    async getAllCriteria(data, options) {
        await this.assertDashboardAccess();
        return await this.loadCriteria({});
    }

    /**
     * The latest live version of every criterion, without scoring options, with the number of live versions.
     *
     * @socketEvent criterionGetLatest
     * @param {Object} data {}
     * @param {Object} options
     * @returns {Promise<Object[]>} one entry per criterion group, ordered by group: the version's own fields,
     *   `settings`, and `versionCount`
     */
    async getLatestCriteria(data, options) {
        await this.assertDashboardAccess();
        const rows = await queryLatestVersions(this.server.db.sequelize, "criterion");
        return rows.map((row) => ({...row, ...criterionFields(row)}));
    }

    /**
     * The live versions of one criterion, newest first.
     *
     * @socketEvent criterionGetVersions
     * @param {Object} data
     * @param {number} data.criterionGroupId group of the criterion
     * @param {Object} options
     * @returns {Promise<{id: number, criterionGroupId: number, versionNumber: string, name: string, createdAt: string}[]>}
     */
    async getCriterionVersions(data, options) {
        await this.assertDashboardAccess();
        const groupId = positiveInt(isObject(data) ? data.criterionGroupId : null);
        const rows = groupId ? await queryVersionHistory(this.server.db.sequelize, "criterion", groupId) : [];
        if (!rows.length) {
            throw new TranslatableError("errors.assessment.criterion.groupNotFound");
        }
        return rows.map(({groupId: criterionGroupId, ...row}) => ({...row, criterionGroupId}));
    }

    /**
     * One criterion version by its database id.
     *
     * @socketEvent criterionGet
     * @param {Object} data
     * @param {number} data.criterionId id of the criterion version
     * @param {Object} options
     * @returns {Promise<Object>} the criterion with its ordered `scoringOptions`
     */
    async getCriterion(data, options) {
        await this.assertDashboardAccess();
        const criterionId = positiveInt(isObject(data) ? data.criterionId : null);
        if (!criterionId) {
            throw new TranslatableError("errors.assessment.criterion.notFound");
        }
        const [row] = await this.loadCriteria({id: criterionId});
        if (!row) {
            throw new TranslatableError("errors.assessment.criterion.notFound");
        }
        return row;
    }

    /**
     * Creates a criterion: new database id, new group id, its first version and its scoring options.
     *
     * @socketEvent criterionCreate
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number|string|null} [data.minPoints]
     * @param {number|string|null} [data.maxPoints] minPoints must not exceed it
     * @param {Object} [data.settings] Advanced Settings (string, number or boolean values; see readSettings)
     * @param {{points: number, description: string}[]} [data.scoringOptions] stored in array order
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored criterion with its scoring options
     * @throws {TranslatableError} when the payload carries a `versionNumber`: the backend assigns it
     */
    async createCriterion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "name"});
        }
        rejectClientVersionNumber(data);
        return await this.insertVersion(data, null, options);
    }

    /**
     * Creates a new version in an existing group. The original version is never touched. With
     * `copyFromId` the new version starts from that version's properties and scoring options;
     * any property in the request replaces the copied one (`scoringOptions` replaces the whole list).
     *
     * @socketEvent criterionCreateVersion
     * @param {Object} data
     * @param {number} [data.criterionGroupId] group of the new version; derived from `copyFromId` when omitted
     * @param {number} [data.copyFromId] criterion version to copy; must belong to `criterionGroupId` if both are given
     * @param {...*} [data] the criterion properties of `criterionCreate`; required unless copied. `settings` replaces
     *   the copied settings as a whole (a key that is not sent is removed)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored criterion with its scoring options
     */
    async createCriterionVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.criterion.groupNotFound");
        }
        rejectClientVersionNumber(data);
        const transaction = options.transaction;
        const {criterion} = this.models;

        let groupId = null;
        if (data.criterionGroupId !== undefined && data.criterionGroupId !== null) {
            groupId = positiveInt(data.criterionGroupId);
            if (!groupId) {
                throw new TranslatableError("errors.assessment.criterion.groupNotFound");
            }
        }

        let source = data;
        let baseSettings = {};
        if (data.copyFromId !== undefined && data.copyFromId !== null) {
            const copyFromId = positiveInt(data.copyFromId);
            const [original] = copyFromId ? await this.loadCriteria({id: copyFromId}, {transaction}) : [];
            if (!original) {
                throw new TranslatableError("errors.assessment.criterion.notFound");
            }
            if (groupId !== null && original.criterionGroupId !== groupId) {
                throw new TranslatableError("errors.assessment.criterion.copySourceMismatch");
            }
            groupId = original.criterionGroupId;
            const copied = {
                name: original.name,
                description: original.description,
                minPoints: original.minPoints,
                maxPoints: original.maxPoints,
                scoringOptions: original.scoringOptions.map(({points, description}) => ({points, description})),
            };
            source = {...copied};
            // settings are resolved in readCriterionSettings against baseSettings
            for (const key of [...Object.keys(copied), "settings"]) {
                if (has(data, key)) {
                    source[key] = data[key];
                }
            }
            baseSettings = original.settings;
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "criterionGroupId"});
        } else if (!(await criterion.findOne({where: {criterionGroupId: groupId, deleted: false}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.criterion.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options, baseSettings);
    }

    /**
     * Soft-deletes one criterion version: the row and its scoring options stay (flagged `deleted`), so the
     * version can still be reconstructed from the database. Refused while a live rubric version references it;
     * other versions of the group are untouched. The database enforces the same rule (see the trigger migration),
     * so a rubric linked at the same moment either is seen here or makes the delete fail.
     *
     * @socketEvent criterionDelete
     * @param {Object} data
     * @param {number} data.criterionId id of the criterion version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, criterionGroupId: number, latestVersionId: number|null}>} the deleted version
     *   and the id of the latest remaining version of its group (null when none is left)
     */
    async deleteCriterion(data, options) {
        await this.assertDashboardAccess();
        const criterionId = positiveInt(isObject(data) ? data.criterionId : null);
        const transaction = options.transaction;
        const {criterion} = this.models;
        const {sequelize} = this.server.db;

        const row = criterionId ? await criterion.findOne({where: {id: criterionId, deleted: false}, transaction}) : null;
        if (!row) {
            throw new TranslatableError("errors.assessment.criterion.notFound");
        }
        await lockVersionGroup(sequelize, "criterion", row.criterionGroupId, transaction);

        const users = await sequelize.query(
            `SELECT r.name, r."versionNumber", r."rubricGroupId" AS "groupId"
             FROM rubric_criterion rc JOIN rubric r ON r.id = rc."rubricId"
             WHERE rc."criterionId" = :criterionId AND rc."deleted" = false ORDER BY r.id`,
            {replacements: {criterionId}, transaction, type: sequelize.QueryTypes.SELECT});
        if (users.length) {
            throw new TranslatableError("errors.assessment.criterion.inUse", inUseParams(row, users));
        }

        try {
            // Model.update, not MetaModel.deleteById: that one wraps every error in a plain Error and the
            // reference check of the database has to arrive as a foreign key error. The triggers flag the scoring options.
            await criterion.update({deleted: true, deletedAt: new Date()}, {where: {id: criterionId}, transaction});
        } catch (error) {
            // a rubric linked it after the check above: the trigger is the final guard
            if (error instanceof ForeignKeyConstraintError) {
                throw new TranslatableError("errors.assessment.criterion.inUseUnknown", inUseUnknownParams(row));
            }
            throw error;
        }
        const latestVersionId = await latestLiveVersionId(sequelize, "criterion", row.criterionGroupId, transaction);
        return {id: row.id, criterionGroupId: row.criterionGroupId, latestVersionId};
    }

    init() {
        this.createSocket("criterionGetAll", this.getAllCriteria, {}, false);
        this.createSocket("criterionGetLatest", this.getLatestCriteria, {}, false);
        this.createSocket("criterionGetVersions", this.getCriterionVersions, {}, false);
        this.createSocket("criterionGet", this.getCriterion, {}, false);
        this.createSocket("criterionCreate", this.createCriterion, {}, true);
        this.createSocket("criterionCreateVersion", this.createCriterionVersion, {}, true);
        this.createSocket("criterionDelete", this.deleteCriterion, {}, true);
    }
}

module.exports = CriterionSocket;
