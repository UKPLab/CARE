"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {inUseParams, inUseUnknownParams} = require("../../utils/helper/assessmentReferenceLabels.js");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {
    DASHBOARD_RIGHT, has, isObject, rejectClientVersionNumber, readText, readOptionalText, readNumber,
    assertPointsRange, readSettings, lockVersionGroup, nextVersionNumber, latestLiveVersionId,
    queryLatestVersions, queryVersionHistory, toNumber, loadRubrics,
} = require("../../utils/helper/assessmentVersions.js");

/**
 * Socket handlers for rubrics (`rubric`) and their criterion associations (`rubric_criterion`).
 *
 * Rubric versions are immutable: there is no update event. A version and all its associations are
 * inserted in one transaction (database triggers reject rows added later); changes are made by
 * creating a new version, numbered automatically ("1", "2", ...). Deleting is a soft delete (the row and its
 * associations stay, flagged `deleted`), refused while a live assessment version uses the rubric. A rubric points at specific, immutable criterion versions; it never
 * creates, changes or deletes them. Everyone with the dashboard right may use every event, whoever
 * created the rubric. The models are not autoTable, so nothing is broadcast; clients re-request.
 *
 * Every request payload must be an object (send `{}` when there is nothing to send).
 *
 * @class RubricSocket
 */
class RubricSocket extends Socket {

    /**
     * @throws {TranslatableError} when the user lacks the dashboard right
     */
    async assertDashboardAccess() {
        if (!(await this.hasAccess(DASHBOARD_RIGHT))) {
            throw new TranslatableError("errors.assessment.accessDenied");
        }
    }

    /**
     * Rubric versions with their ordered criteria (see `loadRubrics` in the shared helper).
     * @param {Object} where Sequelize where for `rubric`
     * @param {Object} [options] Sequelize options (transaction)
     * @returns {Promise<Object[]>}
     */
    async loadRubrics(where, options = {}) {
        return await loadRubrics(this.models, where, options);
    }

    /**
     * Validates the rubric fields and the ordered criterion ids of a create request.
     * @param {Object} source
     * @returns {{fields: Object, criterionIds: number[]}} values ready to insert
     * @throws {TranslatableError}
     */
    validateRubric(source) {
        const fields = {
            name: readText(source, "name"),
            description: readText(source, "description", {allowEmpty: true, maxLength: Infinity}),
            // an inactive bound is stored as NULL
            minPoints: readNumber(source, "minPoints"),
            maxPoints: readNumber(source, "maxPoints"),
            calculation: readOptionalText(source, "calculation"),
            defaultPoints: readNumber(source, "defaultPoints"),
            settings: readSettings(source.settings === undefined ? {} : source.settings),
        };
        assertPointsRange(fields.minPoints, fields.maxPoints);

        // isBonus is NOT NULL with a database default: leave it out to get the default
        if (source.isBonus !== undefined) {
            if (typeof source.isBonus !== "boolean") {
                throw new TranslatableError("errors.assessment.fieldInvalid", {field: "isBonus"});
            }
            fields.isBonus = source.isBonus;
        }

        const rawIds = source.criterionIds === undefined ? [] : source.criterionIds;
        if (!Array.isArray(rawIds)) {
            throw new TranslatableError("errors.assessment.fieldInvalid", {field: "criterionIds"});
        }
        const criterionIds = rawIds.map((value) => {
            const id = typeof value === "number" || typeof value === "string" ? positiveInt(value) : null;
            if (!id) {
                throw new TranslatableError("errors.assessment.fieldInvalid", {field: "criterionIds"});
            }
            return id;
        });
        const duplicate = criterionIds.find((id, index) => criterionIds.indexOf(id) !== index);
        if (duplicate !== undefined) {
            throw new TranslatableError("errors.assessment.rubric.duplicateCriterion", {criterionId: duplicate});
        }

        return {fields, criterionIds};
    }

    /**
     * Inserts a rubric version and its criterion associations in the caller's transaction. The version number
     * is assigned here (under the group lock): "1" for a new rubric, one above the highest number of the group otherwise.
     * @param {Object} source request fields (see validateRubric)
     * @param {number|null} rubricGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @returns {Promise<Object>} the stored rubric with its criteria
     */
    async insertVersion(source, rubricGroupId, options) {
        const {fields, criterionIds} = this.validateRubric(source);
        const {rubric, criterion, rubric_criterion: rubricCriterion} = this.models;
        const {sequelize} = this.server.db;
        const transaction = options.transaction;

        if (criterionIds.length) {
            const found = await criterion.findAll({where: {id: criterionIds, deleted: false}, attributes: ["id"], transaction});
            const foundIds = new Set(found.map((row) => row.id));
            const missing = criterionIds.filter((id) => !foundIds.has(id));
            if (missing.length) {
                throw new TranslatableError("errors.assessment.rubric.criteriaNotFound", {criterionIds: missing.join(", ")});
            }
        }

        if (rubricGroupId !== null) {
            await lockVersionGroup(sequelize, "rubric", rubricGroupId, transaction);
        }
        const versionNumber = rubricGroupId === null
            ? "1" : await nextVersionNumber(sequelize, "rubric", rubricGroupId, transaction);

        let row;
        try {
            row = await rubric.create(
                rubricGroupId === null ? {...fields, versionNumber} : {...fields, versionNumber, rubricGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.versionConflict");
            }
            throw error;
        }

        if (criterionIds.length) {
            try {
                await rubricCriterion.bulkCreate(
                    criterionIds.map((criterionId, index) => ({
                        rubricId: row.id, criterionId, criterionPositionInRubric: index + 1,
                    })),
                    {transaction}
                );
            } catch (error) {
                // a criterion version deleted after the check above: the foreign key is the final guard
                if (error instanceof ForeignKeyConstraintError) {
                    throw new TranslatableError("errors.assessment.rubric.criteriaNotFound", {criterionIds: criterionIds.join(", ")});
                }
                throw error;
            }
        }
        const [stored] = await this.loadRubrics({id: row.id}, {transaction});
        return stored;
    }

    /**
     * All live rubric versions, including historical ones, ordered by group and id with their criteria. The
     * dashboard table and the Versions modal use `rubricGetLatest` and `rubricGetVersions`; this full list feeds the
     * rubric version selection of the assessment modal.
     *
     * @socketEvent rubricGetAll
     * @param {Object} data {} (no filters)
     * @param {Object} options
     * @returns {Promise<Object[]>} rubrics, each with `criteria` ordered by `criterionPositionInRubric`
     */
    async getAllRubrics(data, options) {
        await this.assertDashboardAccess();
        return await this.loadRubrics({});
    }

    /**
     * The latest live version of every rubric, without criteria, with the number of live versions.
     *
     * @socketEvent rubricGetLatest
     * @param {Object} data {}
     * @param {Object} options
     * @returns {Promise<Object[]>} one entry per rubric group, ordered by group: the version's own fields,
     *   `settings` and `versionCount`
     */
    async getLatestRubrics(data, options) {
        await this.assertDashboardAccess();
        const rows = await queryLatestVersions(this.server.db.sequelize, "rubric");
        return rows.map((row) => ({
            ...row,
            minPoints: toNumber(row.minPoints),
            maxPoints: toNumber(row.maxPoints),
            defaultPoints: toNumber(row.defaultPoints),
        }));
    }

    /**
     * The live versions of one rubric, newest first.
     *
     * @socketEvent rubricGetVersions
     * @param {Object} data
     * @param {number} data.rubricGroupId group of the rubric
     * @param {Object} options
     * @returns {Promise<{id: number, rubricGroupId: number, versionNumber: string, name: string, createdAt: string}[]>}
     */
    async getRubricVersions(data, options) {
        await this.assertDashboardAccess();
        const groupId = positiveInt(isObject(data) ? data.rubricGroupId : null);
        const rows = groupId ? await queryVersionHistory(this.server.db.sequelize, "rubric", groupId) : [];
        if (!rows.length) {
            throw new TranslatableError("errors.assessment.rubric.groupNotFound");
        }
        return rows.map(({groupId: rubricGroupId, ...row}) => ({...row, rubricGroupId}));
    }

    /**
     * One rubric version by its database id.
     *
     * @socketEvent rubricGet
     * @param {Object} data
     * @param {number} data.rubricId id of the rubric version
     * @param {Object} options
     * @returns {Promise<Object>} the rubric with its ordered `criteria`
     */
    async getRubric(data, options) {
        await this.assertDashboardAccess();
        const rubricId = positiveInt(isObject(data) ? data.rubricId : null);
        const [row] = rubricId ? await this.loadRubrics({id: rubricId}) : [];
        if (!row) {
            throw new TranslatableError("errors.assessment.rubric.notFound");
        }
        return row;
    }

    /**
     * Creates a rubric: new database id, new group id, its first version and its criterion associations.
     *
     * @socketEvent rubricCreate
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number|string|null} [data.minPoints] empty or null: the bound is not active
     * @param {number|string|null} [data.maxPoints] minPoints must not exceed it
     * @param {Object} [data.settings] Advanced Settings (string, number or boolean values; see readSettings)
     * @param {string|null} [data.calculation] e.g. "sum", "min", "max"; stored as sent
     * @param {number|string|null} [data.defaultPoints]
     * @param {boolean} [data.isBonus] database default (false) when omitted
     * @param {number[]} [data.criterionIds] existing criterion version ids; array order becomes the position (from 1)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored rubric with its criteria
     * @throws {TranslatableError} when the payload carries a `versionNumber`: the backend assigns it
     */
    async createRubric(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "name"});
        }
        rejectClientVersionNumber(data);
        return await this.insertVersion(data, null, options);
    }

    /**
     * Creates a new version in an existing group. Earlier versions and their associations are never
     * touched, and assessments that use them are not updated. With `copyFromId` the new version starts
     * from that version's properties and criteria; any property in the request replaces the copied one
     * (`criterionIds` replaces the whole selection and order, `null` clears a nullable field).
     *
     * @socketEvent rubricCreateVersion
     * @param {Object} data
     * @param {number} [data.rubricGroupId] group of the new version; derived from `copyFromId` when omitted
     * @param {number} [data.copyFromId] rubric version to copy; must belong to `rubricGroupId` if both are given
     * @param {...*} [data] the rubric properties of `rubricCreate`; required unless copied (`settings` replaces the
     *   copied settings as a whole)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored rubric with its criteria (new association ids)
     */
    async createRubricVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.rubric.groupNotFound");
        }
        rejectClientVersionNumber(data);
        const transaction = options.transaction;
        const {rubric} = this.models;

        let groupId = null;
        if (data.rubricGroupId !== undefined && data.rubricGroupId !== null) {
            groupId = positiveInt(data.rubricGroupId);
            if (!groupId) {
                throw new TranslatableError("errors.assessment.rubric.groupNotFound");
            }
        }

        let source = data;
        if (data.copyFromId !== undefined && data.copyFromId !== null) {
            const copyFromId = positiveInt(data.copyFromId);
            const [original] = copyFromId ? await this.loadRubrics({id: copyFromId}, {transaction}) : [];
            if (!original) {
                throw new TranslatableError("errors.assessment.rubric.notFound");
            }
            if (groupId !== null && original.rubricGroupId !== groupId) {
                throw new TranslatableError("errors.assessment.rubric.copySourceMismatch");
            }
            groupId = original.rubricGroupId;
            const copied = {
                name: original.name,
                description: original.description,
                minPoints: original.minPoints,
                maxPoints: original.maxPoints,
                calculation: original.calculation,
                defaultPoints: original.defaultPoints,
                isBonus: original.isBonus,
                settings: original.settings,
                criterionIds: original.criteria.map((link) => link.criterionId),
            };
            source = {...copied};
            for (const key of Object.keys(copied)) {
                if (has(data, key)) {
                    source[key] = data[key];
                }
            }
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "rubricGroupId"});
        } else if (!(await rubric.findOne({where: {rubricGroupId: groupId, deleted: false}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.rubric.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options);
    }

    /**
     * Soft-deletes one rubric version: the row and its criterion associations stay (flagged `deleted`), so the
     * version can still be reconstructed. Refused while a live assessment version references it. Criterion
     * versions and other rubric versions are untouched. The database enforces the same rule (see the trigger
     * migration), so an assessment linked at the same moment either is seen here or makes the delete fail.
     *
     * @socketEvent rubricDelete
     * @param {Object} data
     * @param {number} data.rubricId id of the rubric version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, rubricGroupId: number, latestVersionId: number|null}>} the deleted version and
     *   the id of the latest remaining version of its group (null when none is left)
     */
    async deleteRubric(data, options) {
        await this.assertDashboardAccess();
        const rubricId = positiveInt(isObject(data) ? data.rubricId : null);
        const transaction = options.transaction;
        const {rubric} = this.models;
        const {sequelize} = this.server.db;

        const row = rubricId ? await rubric.findOne({where: {id: rubricId, deleted: false}, transaction}) : null;
        if (!row) {
            throw new TranslatableError("errors.assessment.rubric.notFound");
        }
        await lockVersionGroup(sequelize, "rubric", row.rubricGroupId, transaction);

        const users = await sequelize.query(
            `SELECT a.name, a."versionNumber", a."assessmentGroupId" AS "groupId"
             FROM assessment_rubric ar JOIN assessment a ON a.id = ar."assessmentId"
             WHERE ar."rubricId" = :rubricId AND ar."deleted" = false ORDER BY a.id`,
            {replacements: {rubricId}, transaction, type: sequelize.QueryTypes.SELECT});
        if (users.length) {
            throw new TranslatableError("errors.assessment.rubric.inUse", inUseParams(row, users));
        }

        try {
            // Model.update, not MetaModel.deleteById: that one wraps every error in a plain Error and the
            // reference check of the database has to arrive as a foreign key error. The triggers flag the associations.
            await rubric.update({deleted: true, deletedAt: new Date()}, {where: {id: rubricId}, transaction});
        } catch (error) {
            // an assessment linked it after the check above: the trigger is the final guard
            if (error instanceof ForeignKeyConstraintError) {
                throw new TranslatableError("errors.assessment.rubric.inUseUnknown", inUseUnknownParams(row));
            }
            throw error;
        }
        const latestVersionId = await latestLiveVersionId(sequelize, "rubric", row.rubricGroupId, transaction);
        return {id: row.id, rubricGroupId: row.rubricGroupId, latestVersionId};
    }

    init() {
        this.createSocket("rubricGetAll", this.getAllRubrics, {}, false);
        this.createSocket("rubricGetLatest", this.getLatestRubrics, {}, false);
        this.createSocket("rubricGetVersions", this.getRubricVersions, {}, false);
        this.createSocket("rubricGet", this.getRubric, {}, false);
        this.createSocket("rubricCreate", this.createRubric, {}, true);
        this.createSocket("rubricCreateVersion", this.createRubricVersion, {}, true);
        this.createSocket("rubricDelete", this.deleteRubric, {}, true);
    }
}

module.exports = RubricSocket;
