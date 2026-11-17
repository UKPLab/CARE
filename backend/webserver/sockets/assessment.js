"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {softDeleteAssessmentVersion} = require("../../utils/helper/assessmentLifecycle.js");
const {
    DASHBOARD_RIGHT, has, isObject, rejectClientVersionNumber, readText, lockVersionGroup, nextVersionNumber,
    latestLiveVersionId, queryLatestVersions, queryVersionHistory, loadRubrics,
} = require("../../utils/helper/assessmentVersions.js");

/**
 * Socket handlers for assessments (`assessment`) and their rubric associations (`assessment_rubric`).
 *
 * Assessment versions are immutable: there is no update event. A version and all its associations
 * are inserted in one transaction (database triggers reject rows added later); changes are made by
 * creating a new version. An assessment points at specific, immutable rubric versions; it never
 * creates, changes or deletes them. Everyone with the dashboard right may use every event, whoever
 * created the assessment. The models are not autoTable, so nothing is broadcast; clients re-request.
 *
 * Deleting is refused while the assessment version is referenced from JSON (study steps, study templates, triggers,
 * trigger actions, pending trigger runs); see utils/helper/assessmentReferences.js for what is checked. The writers of
 * such references are guarded in the database (migration 20261116120000-add-assessment-reference-guard.js), so a
 * reference cannot be saved while the delete runs, nor to a version that is already deleted.
 *
 * Every request payload must be an object (send `{}` when there is nothing to send).
 *
 * @class AssessmentSocket
 */
class AssessmentSocket extends Socket {

    /**
     * @throws {TranslatableError} when the user lacks the dashboard right
     */
    async assertDashboardAccess() {
        if (!(await this.hasAccess(DASHBOARD_RIGHT))) {
            throw new TranslatableError("errors.assessment.accessDenied");
        }
    }

    /**
     * Live (not soft-deleted) assessment versions with their rubrics ordered by `rubricPositionInAssessment`, API shape.
     * Each association is `{id, assessmentId, rubricId, rubricPositionInAssessment, rubric}`; `id` is the
     * rubric association id and `rubric` the full rubric version with its ordered criteria (as returned by
     * the rubric events). Three queries however many assessments: assessments with their links, then the
     * rubrics with their links, then the criteria with their options.
     * @param {Object} where Sequelize where for `assessment`
     * @param {Object} [options] Sequelize options (transaction)
     * @returns {Promise<Object[]>}
     */
    async loadAssessments(where, options = {}) {
        const {assessment, assessment_rubric: assessmentRubric} = this.models;
        const rows = await assessment.findAll({
            where: {...where, deleted: false},
            include: [{model: assessmentRubric, as: "assessmentRubrics", where: {deleted: false}, required: false}],
            order: [
                ["assessmentGroupId", "ASC"],
                ["id", "ASC"],
                [{model: assessmentRubric, as: "assessmentRubrics"}, "rubricPositionInAssessment", "ASC"],
            ],
            transaction: options.transaction,
        });
        const plainRows = rows.map((row) => row.get({plain: true}));

        const rubricIds = [...new Set(plainRows.flatMap((row) => row.assessmentRubrics.map((link) => link.rubricId)))];
        const rubrics = rubricIds.length ? await loadRubrics(this.models, {id: rubricIds}, options) : [];
        const rubricById = new Map(rubrics.map((rubric) => [rubric.id, rubric]));

        return plainRows.map(({assessmentRubrics, ...plain}) => ({
            ...plain,
            rubrics: assessmentRubrics.map((link) => ({...link, rubric: rubricById.get(link.rubricId)})),
        }));
    }

    /**
     * Validates the assessment fields and the ordered rubric ids of a create request.
     * @param {Object} source
     * @returns {{fields: Object, rubricIds: number[]}} values ready to insert
     * @throws {TranslatableError}
     */
    validateAssessment(source) {
        const fields = {
            name: readText(source, "name"),
            description: readText(source, "description", {allowEmpty: true, maxLength: Infinity}),
        };

        const rawIds = source.rubricIds === undefined ? [] : source.rubricIds;
        if (!Array.isArray(rawIds)) {
            throw new TranslatableError("errors.assessment.fieldInvalid", {field: "rubricIds"});
        }
        const rubricIds = rawIds.map((value) => {
            const id = typeof value === "number" || typeof value === "string" ? positiveInt(value) : null;
            if (!id) {
                throw new TranslatableError("errors.assessment.fieldInvalid", {field: "rubricIds"});
            }
            return id;
        });
        const duplicate = rubricIds.find((id, index) => rubricIds.indexOf(id) !== index);
        if (duplicate !== undefined) {
            throw new TranslatableError("errors.assessment.assessment.duplicateRubric", {rubricId: duplicate});
        }

        return {fields, rubricIds};
    }

    /**
     * Inserts an assessment version and its rubric associations in the caller's transaction. The version number
     * and the predecessor link are assigned here (under the group lock).
     * @param {Object} source request fields (see validateAssessment)
     * @param {number|null} assessmentGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics
     */
    async insertVersion(source, assessmentGroupId, options) {
        const {fields, rubricIds} = this.validateAssessment(source);
        const {assessment, rubric, assessment_rubric: assessmentRubric} = this.models;
        const {sequelize} = this.server.db;
        const transaction = options.transaction;

        if (rubricIds.length) {
            const found = await rubric.findAll({where: {id: rubricIds, deleted: false}, attributes: ["id"], transaction});
            const foundIds = new Set(found.map((row) => row.id));
            const missing = rubricIds.filter((id) => !foundIds.has(id));
            if (missing.length) {
                throw new TranslatableError("errors.assessment.assessment.rubricsNotFound", {rubricIds: missing.join(", ")});
            }
        }

        // The new version points at the latest live version of its group (NULL for the first one). Both the
        // number and the predecessor are read under the group lock; the database re-checks the predecessor.
        let previousAssessmentVersionId = null;
        if (assessmentGroupId !== null) {
            await lockVersionGroup(sequelize, "assessment", assessmentGroupId, transaction);
            previousAssessmentVersionId = await latestLiveVersionId(sequelize, "assessment", assessmentGroupId, transaction);
        }
        const versionNumber = assessmentGroupId === null
            ? "1" : await nextVersionNumber(sequelize, "assessment", assessmentGroupId, transaction);

        let row;
        try {
            row = await assessment.create(
                assessmentGroupId === null
                    ? {...fields, versionNumber, previousAssessmentVersionId}
                    : {...fields, versionNumber, previousAssessmentVersionId, assessmentGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.versionConflict");
            }
            throw error;
        }

        if (rubricIds.length) {
            try {
                await assessmentRubric.bulkCreate(
                    rubricIds.map((rubricId, index) => ({
                        assessmentId: row.id, rubricId, rubricPositionInAssessment: index + 1,
                    })),
                    {transaction}
                );
            } catch (error) {
                // a rubric version deleted after the check above: the foreign key is the final guard
                if (error instanceof ForeignKeyConstraintError) {
                    throw new TranslatableError("errors.assessment.assessment.rubricsNotFound", {rubricIds: rubricIds.join(", ")});
                }
                throw error;
            }
        }
        const [stored] = await this.loadAssessments({id: row.id}, {transaction});
        return stored;
    }

    /**
     * All live assessment versions, including historical ones, ordered by group and id. The dashboard tables use
     * `assessmentGetLatest` and `assessmentGetVersions`; this full list is for callers that need every version.
     *
     * @socketEvent assessmentGetAll
     * @param {Object} data {} (no filters)
     * @param {Object} options
     * @returns {Promise<Object[]>} assessments, each with `rubrics` ordered by `rubricPositionInAssessment`
     */
    async getAllAssessments(data, options) {
        await this.assertDashboardAccess();
        return await this.loadAssessments({});
    }

    /**
     * The latest live version of every assessment, without rubrics, with the number of live versions.
     *
     * @socketEvent assessmentGetLatest
     * @param {Object} data {}
     * @param {Object} options
     * @returns {Promise<Object[]>} one entry per assessment group, ordered by group: the version's own fields
     *   (including `previousAssessmentVersionId`) and `versionCount`
     */
    async getLatestAssessments(data, options) {
        await this.assertDashboardAccess();
        return await queryLatestVersions(this.server.db.sequelize, "assessment");
    }

    /**
     * The live versions of one assessment, newest first.
     *
     * @socketEvent assessmentGetVersions
     * @param {Object} data
     * @param {number} data.assessmentGroupId group of the assessment
     * @param {Object} options
     * @returns {Promise<{id: number, assessmentGroupId: number, versionNumber: string, name: string, createdAt: string}[]>}
     */
    async getAssessmentVersions(data, options) {
        await this.assertDashboardAccess();
        const groupId = positiveInt(isObject(data) ? data.assessmentGroupId : null);
        const rows = groupId ? await queryVersionHistory(this.server.db.sequelize, "assessment", groupId) : [];
        if (!rows.length) {
            throw new TranslatableError("errors.assessment.assessment.groupNotFound");
        }
        return rows.map(({groupId: assessmentGroupId, ...row}) => ({...row, assessmentGroupId}));
    }

    /**
     * One assessment version by its database id.
     *
     * @socketEvent assessmentGet
     * @param {Object} data
     * @param {number} data.assessmentId id of the assessment version
     * @param {Object} options
     * @returns {Promise<Object>} the assessment with its ordered `rubrics`
     */
    async getAssessment(data, options) {
        await this.assertDashboardAccess();
        const assessmentId = positiveInt(isObject(data) ? data.assessmentId : null);
        const [row] = assessmentId ? await this.loadAssessments({id: assessmentId}) : [];
        if (!row) {
            throw new TranslatableError("errors.assessment.assessment.notFound");
        }
        return row;
    }

    /**
     * Creates an assessment: new database id, new group id, its first version and its rubric associations.
     *
     * @socketEvent assessmentCreate
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number[]} [data.rubricIds] existing rubric version ids; array order becomes the position (from 1)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics
     * @throws {TranslatableError} when the payload carries a `versionNumber`: the backend assigns it
     */
    async createAssessment(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "name"});
        }
        rejectClientVersionNumber(data);
        return await this.insertVersion(data, null, options);
    }

    /**
     * Creates a new version in an existing group. Earlier versions and their associations are never
     * touched, and newer rubric versions are never picked up automatically. With `copyFromId` the new
     * version starts from that version's properties and rubrics; any property in the request replaces the
     * copied one (`rubricIds` replaces the whole selection and order).
     *
     * @socketEvent assessmentCreateVersion
     * @param {Object} data
     * @param {number} [data.assessmentGroupId] group of the new version; derived from `copyFromId` when omitted
     * @param {number} [data.copyFromId] assessment version to copy; must belong to `assessmentGroupId` if both are given
     * @param {...*} [data] the assessment properties of `assessmentCreate`; required unless copied
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics (new association ids)
     */
    async createAssessmentVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.assessment.groupNotFound");
        }
        rejectClientVersionNumber(data);
        const transaction = options.transaction;
        const {assessment} = this.models;

        let groupId = null;
        if (data.assessmentGroupId !== undefined && data.assessmentGroupId !== null) {
            groupId = positiveInt(data.assessmentGroupId);
            if (!groupId) {
                throw new TranslatableError("errors.assessment.assessment.groupNotFound");
            }
        }

        let source = data;
        if (data.copyFromId !== undefined && data.copyFromId !== null) {
            const copyFromId = positiveInt(data.copyFromId);
            const [original] = copyFromId ? await this.loadAssessments({id: copyFromId}, {transaction}) : [];
            if (!original) {
                throw new TranslatableError("errors.assessment.assessment.notFound");
            }
            if (groupId !== null && original.assessmentGroupId !== groupId) {
                throw new TranslatableError("errors.assessment.assessment.copySourceMismatch");
            }
            groupId = original.assessmentGroupId;
            const copied = {
                name: original.name,
                description: original.description,
                rubricIds: original.rubrics.map((link) => link.rubricId),
            };
            source = {...copied};
            for (const key of Object.keys(copied)) {
                if (has(data, key)) {
                    source[key] = data[key];
                }
            }
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "assessmentGroupId"});
        } else if (!(await assessment.findOne({where: {assessmentGroupId: groupId, deleted: false}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.assessment.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options);
    }

    /**
     * Soft-deletes one assessment version (see `softDeleteAssessmentVersion`): refused while it is referenced from
     * a study step (also of a study template), a trigger, a trigger action or a pending trigger run; the live
     * successor is re-linked to its predecessor; rubric versions and other assessment versions are untouched.
     *
     * @socketEvent assessmentDelete
     * @param {Object} data
     * @param {number} data.assessmentId id of the assessment version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, assessmentGroupId: number, latestVersionId: number|null}>} the deleted version
     */
    async deleteAssessment(data, options) {
        await this.assertDashboardAccess();
        const assessmentId = positiveInt(isObject(data) ? data.assessmentId : null);
        if (!assessmentId) {
            throw new TranslatableError("errors.assessment.assessment.notFound");
        }
        return await softDeleteAssessmentVersion(this.server.db.sequelize, assessmentId, options.transaction);
    }

    init() {
        this.createSocket("assessmentGetAll", this.getAllAssessments, {}, false);
        this.createSocket("assessmentGetLatest", this.getLatestAssessments, {}, false);
        this.createSocket("assessmentGetVersions", this.getAssessmentVersions, {}, false);
        this.createSocket("assessmentGet", this.getAssessment, {}, false);
        this.createSocket("assessmentCreate", this.createAssessment, {}, true);
        this.createSocket("assessmentCreateVersion", this.createAssessmentVersion, {}, true);
        this.createSocket("assessmentDelete", this.deleteAssessment, {}, true);
    }
}

module.exports = AssessmentSocket;
