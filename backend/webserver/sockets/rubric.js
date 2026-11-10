"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {
    DASHBOARD_RIGHT, has, isObject, toNumber, readVersionNumber, readText, readOptionalText, readNumber,
    assertPointsRange, loadCriteria,
} = require("../../utils/helper/assessmentVersions.js");

/**
 * Socket handlers for rubrics (`rubric`) and their criterion associations (`rubric_criterion`).
 *
 * Rubric versions are immutable: there is no update event. A version and all its associations are
 * inserted in one transaction (database triggers reject rows added later); changes are made by
 * creating a new version. A rubric points at specific, immutable criterion versions; it never
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
     * Rubric versions with their criteria ordered by `criterionPositionInRubric`, API shape (plain numbers).
     * Each association is `{id, rubricId, criterionId, criterionPositionInRubric, criterion}`; `id` is the
     * criterion association id and `criterion` the full criterion version with its ordered scoring options.
     * @param {Object} where Sequelize where for `rubric`
     * @param {Object} [options] Sequelize options (transaction)
     * @returns {Promise<Object[]>}
     */
    async loadRubrics(where, options = {}) {
        const {rubric, rubric_criterion: rubricCriterion} = this.models;
        const rows = await rubric.findAll({
            where,
            include: [{model: rubricCriterion, as: "rubricCriteria"}],
            order: [
                ["rubricGroupId", "ASC"],
                ["id", "ASC"],
                [{model: rubricCriterion, as: "rubricCriteria"}, "criterionPositionInRubric", "ASC"],
            ],
            transaction: options.transaction,
        });
        const plainRows = rows.map((row) => row.get({plain: true}));

        // criteria are loaded separately: a deeper include would exceed PostgreSQL's 63 character alias limit
        const criterionIds = [...new Set(plainRows.flatMap((row) => row.rubricCriteria.map((link) => link.criterionId)))];
        const criteria = criterionIds.length ? await loadCriteria(this.models, {id: criterionIds}, options) : [];
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
     * Validates the rubric fields and the ordered criterion ids of a create request.
     * @param {Object} source
     * @returns {{fields: Object, criterionIds: number[]}} values ready to insert
     * @throws {TranslatableError}
     */
    validateRubric(source) {
        const fields = {
            versionNumber: readVersionNumber(source),
            name: readText(source, "name"),
            description: readText(source, "description", {allowEmpty: true, maxLength: Infinity}),
            minPoints: readNumber(source, "minPoints", true),
            maxPoints: readNumber(source, "maxPoints", true),
            calculation: readOptionalText(source, "calculation"),
            defaultPoints: readNumber(source, "defaultPoints"),
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
     * Inserts a rubric version and its criterion associations in the caller's transaction.
     * @param {Object} source request fields (see validateRubric)
     * @param {number|null} rubricGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @returns {Promise<Object>} the stored rubric with its criteria
     */
    async insertVersion(source, rubricGroupId, options) {
        const {fields, criterionIds} = this.validateRubric(source);
        const {rubric, criterion, rubric_criterion: rubricCriterion} = this.models;
        const transaction = options.transaction;

        if (criterionIds.length) {
            const found = await criterion.findAll({where: {id: criterionIds}, attributes: ["id"], transaction});
            const foundIds = new Set(found.map((row) => row.id));
            const missing = criterionIds.filter((id) => !foundIds.has(id));
            if (missing.length) {
                throw new TranslatableError("errors.assessment.rubric.criteriaNotFound", {criterionIds: missing.join(", ")});
            }
        }

        let row;
        try {
            row = await rubric.create(
                rubricGroupId === null ? fields : {...fields, rubricGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.rubric.versionExists", {
                    versionNumber: fields.versionNumber,
                });
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
     * All rubric versions, including historical ones, ordered by group and id.
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
     * @param {string} data.versionNumber entered by the user
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number|string} data.minPoints
     * @param {number|string} data.maxPoints minPoints must not exceed it
     * @param {string|null} [data.calculation] e.g. "sum", "min", "max"; stored as sent
     * @param {number|string|null} [data.defaultPoints]
     * @param {boolean} [data.isBonus] database default (false) when omitted
     * @param {number[]} [data.criterionIds] existing criterion version ids; array order becomes the position (from 1)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored rubric with its criteria
     */
    async createRubric(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "versionNumber"});
        }
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
     * @param {string} data.versionNumber entered by the user, unique within the group
     * @param {...*} [data] the rubric properties of `rubricCreate`; required unless copied
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored rubric with its criteria (new association ids)
     */
    async createRubricVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.rubric.groupNotFound");
        }
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
                criterionIds: original.criteria.map((link) => link.criterionId),
            };
            source = {...copied};
            for (const key of Object.keys(copied)) {
                if (has(data, key)) {
                    source[key] = data[key];
                }
            }
            source.versionNumber = data.versionNumber;
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "rubricGroupId"});
        } else if (!(await rubric.findOne({where: {rubricGroupId: groupId}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.rubric.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options);
    }

    /**
     * Permanently deletes one rubric version and its criterion associations. Refused while an
     * assessment version references it. Criterion versions and other rubric versions are untouched.
     *
     * @socketEvent rubricDelete
     * @param {Object} data
     * @param {number} data.rubricId id of the rubric version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, rubricGroupId: number}>} the deleted version
     */
    async deleteRubric(data, options) {
        await this.assertDashboardAccess();
        const rubricId = positiveInt(isObject(data) ? data.rubricId : null);
        const transaction = options.transaction;
        const {rubric, assessment_rubric: assessmentRubric} = this.models;

        const row = rubricId ? await rubric.findByPk(rubricId, {transaction}) : null;
        if (!row) {
            throw new TranslatableError("errors.assessment.rubric.notFound");
        }

        const references = await assessmentRubric.findAll({
            where: {rubricId}, attributes: ["assessmentId"], order: [["assessmentId", "ASC"]], transaction,
        });
        if (references.length) {
            const assessmentIds = references.map((reference) => reference.assessmentId);
            throw new TranslatableError("errors.assessment.rubric.inUse", {
                rubricId,
                count: assessmentIds.length,
                assessmentIds: assessmentIds.join(", "),
            });
        }

        try {
            // rubric_criterion rows go with it (ON DELETE CASCADE); criterion rows are not touched
            await rubric.destroy({where: {id: rubricId}, transaction});
        } catch (error) {
            // an assessment linked it after the check above: the RESTRICT foreign key is the final guard
            if (error instanceof ForeignKeyConstraintError) {
                throw new TranslatableError("errors.assessment.rubric.inUse", {rubricId, count: 1, assessmentIds: "?"});
            }
            throw error;
        }
        return {id: row.id, rubricGroupId: row.rubricGroupId};
    }

    init() {
        this.createSocket("rubricGetAll", this.getAllRubrics, {}, false);
        this.createSocket("rubricGet", this.getRubric, {}, false);
        this.createSocket("rubricCreate", this.createRubric, {}, true);
        this.createSocket("rubricCreateVersion", this.createRubricVersion, {}, true);
        this.createSocket("rubricDelete", this.deleteRubric, {}, true);
    }
}

module.exports = RubricSocket;
