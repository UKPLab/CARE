"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
// used as a module object so tests can pause the reference check while the row lock is held
const assessmentReferences = require("../../utils/helper/assessmentReferences.js");
const {
    DASHBOARD_RIGHT, has, isObject, readVersionNumber, readText, loadRubrics,
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
 * Deleting is currently disabled (`deleteEnabled`). Once enabled it is refused while the assessment is
 * referenced from JSON (study steps, study templates,
 * triggers, trigger queue); see utils/helper/assessmentReferences.js for what is checked and for the
 * writer-side lock that is still required before the delete is fully race-safe.
 *
 * Every request payload must be an object (send `{}` when there is nothing to send).
 *
 * @class AssessmentSocket
 */
class AssessmentSocket extends Socket {

    /**
     * TEMPORARILY OFF: `assessmentDelete` answers `errors.assessment.assessment.deleteDisabled` and does
     * nothing else. The reference check and the row lock below are in place, but no writer of an
     * assessment id (study steps, templates, triggers, AI hooks) takes the matching `FOR KEY SHARE` lock
     * yet, so a concurrent save could still leave a dangling reference. Set to `true` only after the
     * writer-side locking is integrated; the exact steps are in the "Enabling assessment deletion"
     * section of the Stage 2C report (carexllm reports/issues/489).
     * Checked on the server inside the handler, so calling the socket event directly cannot bypass it.
     * @type {boolean}
     */
    static deleteEnabled = false;

    /**
     * @throws {TranslatableError} when the user lacks the dashboard right
     */
    async assertDashboardAccess() {
        if (!(await this.hasAccess(DASHBOARD_RIGHT))) {
            throw new TranslatableError("errors.assessment.accessDenied");
        }
    }

    /**
     * Assessment versions with their rubrics ordered by `rubricPositionInAssessment`, API shape.
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
            where,
            include: [{model: assessmentRubric, as: "assessmentRubrics"}],
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
            versionNumber: readVersionNumber(source),
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
     * Inserts an assessment version and its rubric associations in the caller's transaction.
     * @param {Object} source request fields (see validateAssessment)
     * @param {number|null} assessmentGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics
     */
    async insertVersion(source, assessmentGroupId, options) {
        const {fields, rubricIds} = this.validateAssessment(source);
        const {assessment, rubric, assessment_rubric: assessmentRubric} = this.models;
        const transaction = options.transaction;

        if (rubricIds.length) {
            const found = await rubric.findAll({where: {id: rubricIds}, attributes: ["id"], transaction});
            const foundIds = new Set(found.map((row) => row.id));
            const missing = rubricIds.filter((id) => !foundIds.has(id));
            if (missing.length) {
                throw new TranslatableError("errors.assessment.assessment.rubricsNotFound", {rubricIds: missing.join(", ")});
            }
        }

        let row;
        try {
            row = await assessment.create(
                assessmentGroupId === null ? fields : {...fields, assessmentGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.assessment.versionExists", {
                    versionNumber: fields.versionNumber,
                });
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
     * All assessment versions, including historical ones, ordered by group and id.
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
     * @param {string} data.versionNumber entered by the user
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number[]} [data.rubricIds] existing rubric version ids; array order becomes the position (from 1)
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics
     */
    async createAssessment(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "versionNumber"});
        }
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
     * @param {string} data.versionNumber entered by the user, unique within the group
     * @param {...*} [data] the assessment properties of `assessmentCreate`; required unless copied
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored assessment with its rubrics (new association ids)
     */
    async createAssessmentVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.assessment.groupNotFound");
        }
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
            source.versionNumber = data.versionNumber;
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "assessmentGroupId"});
        } else if (!(await assessment.findOne({where: {assessmentGroupId: groupId}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.assessment.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options);
    }

    /**
     * DISABLED while `AssessmentSocket.deleteEnabled` is false: after the permission check it throws
     * `errors.assessment.assessment.deleteDisabled`, before reading or locking anything.
     *
     * Permanently deletes one assessment version and its rubric associations. Refused while it is
     * referenced from a study step (also of a study template), a trigger, a trigger action or a pending
     * trigger run. Rubric versions and other assessment versions are untouched.
     *
     * Order matters for concurrency: the assessment row is locked `FOR UPDATE` first, and only then are
     * the references read. A writer that follows the writer-side protocol (`FOR KEY SHARE` on the row
     * before saving a reference) either finishes before the lock is granted and is seen by the check, or
     * waits and then finds the row gone. Writers that do not follow it yet are not covered (see
     * utils/helper/assessmentReferences.js).
     *
     * @socketEvent assessmentDelete
     * @param {Object} data
     * @param {number} data.assessmentId id of the assessment version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, assessmentGroupId: number}>} the deleted version
     */
    async deleteAssessment(data, options) {
        await this.assertDashboardAccess();
        if (!AssessmentSocket.deleteEnabled) {
            throw new TranslatableError("errors.assessment.assessment.deleteDisabled");
        }
        const assessmentId = positiveInt(isObject(data) ? data.assessmentId : null);
        const transaction = options.transaction;
        const {assessment} = this.models;

        const row = assessmentId
            ? await assessment.findByPk(assessmentId, {transaction, lock: transaction.LOCK.UPDATE})
            : null;
        if (!row) {
            throw new TranslatableError("errors.assessment.assessment.notFound");
        }

        const references = await assessmentReferences.findAssessmentReferences(this.server.db.sequelize, assessmentId, transaction);
        const count = assessmentReferences.countReferences(references);
        if (count) {
            const list = (ids) => ids.join(", ") || "-";
            throw new TranslatableError("errors.assessment.assessment.inUse", {
                assessmentId,
                count,
                studySteps: list(references.studySteps),
                templateSteps: list(references.templateSteps),
                triggers: list(references.triggers),
                triggerActions: list(references.triggerActions),
                queuedRuns: list(references.queuedRuns),
            });
        }

        // assessment_rubric rows go with it (ON DELETE CASCADE); rubric rows are not touched
        await assessment.destroy({where: {id: assessmentId}, transaction});
        return {id: row.id, assessmentGroupId: row.assessmentGroupId};
    }

    init() {
        this.createSocket("assessmentGetAll", this.getAllAssessments, {}, false);
        this.createSocket("assessmentGet", this.getAssessment, {}, false);
        this.createSocket("assessmentCreate", this.createAssessment, {}, true);
        this.createSocket("assessmentCreateVersion", this.createAssessmentVersion, {}, true);
        this.createSocket("assessmentDelete", this.deleteAssessment, {}, true);
    }
}

module.exports = AssessmentSocket;
