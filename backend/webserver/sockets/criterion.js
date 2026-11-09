"use strict";

const {UniqueConstraintError, ForeignKeyConstraintError} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");

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

/**
 * Socket handlers for criteria (`criterion`) and their scoring options (`criterion_scoring_option`).
 *
 * Criterion versions are immutable: there is no update event. A version and all its scoring options
 * are inserted in one transaction (database triggers reject rows added later); changes are made by
 * creating a new version. Everyone with the dashboard right may use every event, whoever created
 * the criterion. The six assessment models are not autoTable, so nothing is broadcast; clients
 * re-request with `criterionGetAll`.
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
        const {criterion, criterion_scoring_option: scoringOption} = this.models;
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
        return rows.map((row) => {
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
        });
    }

    /**
     * Validates the criterion fields and scoring options of a create request. Only what the schema
     * requires or what has a defined meaning is checked; nothing else is restricted or defaulted.
     * @param {Object} source
     * @returns {{fields: Object, scoringOptions: Object[]}} values ready to insert
     * @throws {TranslatableError}
     */
    validateCriterion(source) {
        const required = (field) => new TranslatableError("errors.assessment.fieldRequired", {field});
        const invalid = (field) => new TranslatableError("errors.assessment.fieldInvalid", {field});

        const text = (field, {allowEmpty = false} = {}) => {
            const value = source[field];
            if (value === undefined || value === null) {
                throw required(field);
            }
            if (typeof value !== "string" || value.length > MAX_STRING && field !== "description") {
                throw invalid(field);
            }
            if (!allowEmpty && value.trim() === "") {
                throw required(field);
            }
            return value;
        };

        let versionNumber = source.versionNumber;
        if (typeof versionNumber === "number" && Number.isFinite(versionNumber)) {
            versionNumber = String(versionNumber);
        }
        if (versionNumber === undefined || versionNumber === null) {
            throw required("versionNumber");
        }
        if (typeof versionNumber !== "string" || versionNumber.trim().length > MAX_STRING) {
            throw invalid("versionNumber");
        }
        versionNumber = versionNumber.trim();
        if (versionNumber === "") {
            throw required("versionNumber");
        }

        const fields = {
            versionNumber,
            name: text("name"),
            description: text("description", {allowEmpty: true}),
            minPoints: null,
            maxPoints: null,
            function: null,
            subjective: source.subjective,
            expertLevel: source.expertLevel,
        };

        if (source.subjective === undefined || source.subjective === null) {
            throw required("subjective");
        }
        if (typeof source.subjective !== "boolean") {
            throw invalid("subjective");
        }
        if (source.expertLevel === undefined || source.expertLevel === null) {
            throw required("expertLevel");
        }
        if (!Number.isInteger(source.expertLevel)) {
            throw invalid("expertLevel");
        }

        for (const field of ["minPoints", "maxPoints"]) {
            const value = source[field];
            if (value !== undefined && value !== null) {
                if (!isNumeric(value)) {
                    throw invalid(field);
                }
                fields[field] = typeof value === "string" ? value.trim() : value;
            }
        }
        if (fields.minPoints !== null && fields.maxPoints !== null
            && Number(fields.minPoints) > Number(fields.maxPoints)) {
            throw new TranslatableError("errors.assessment.pointsRange");
        }

        if (source.function !== undefined && source.function !== null) {
            if (typeof source.function !== "string" || source.function.length > MAX_STRING) {
                throw invalid("function");
            }
            fields.function = source.function;
        }

        const rawOptions = source.scoringOptions === undefined ? [] : source.scoringOptions;
        if (!Array.isArray(rawOptions)) {
            throw invalid("scoringOptions");
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

        return {fields, scoringOptions};
    }

    /**
     * Inserts a criterion version and its scoring options in the caller's transaction.
     * @param {Object} source request fields (see validateCriterion)
     * @param {number|null} criterionGroupId existing group for a new version, null to start a new group
     * @param {Object} options socket options with the open transaction
     * @returns {Promise<Object>} the stored criterion with its scoring options
     */
    async insertVersion(source, criterionGroupId, options) {
        const {fields, scoringOptions} = this.validateCriterion(source);
        const {criterion, criterion_scoring_option: scoringOption} = this.models;
        const transaction = options.transaction;

        let row;
        try {
            row = await criterion.create(
                criterionGroupId === null ? fields : {...fields, criterionGroupId},
                {transaction}
            );
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new TranslatableError("errors.assessment.criterion.versionExists", {
                    versionNumber: fields.versionNumber,
                });
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
     * All criterion versions, including historical ones, ordered by group and id.
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
     * @param {string} data.versionNumber entered by the user
     * @param {string} data.name
     * @param {string} data.description may be empty
     * @param {number} data.expertLevel integer
     * @param {boolean} data.subjective
     * @param {number|string|null} [data.minPoints]
     * @param {number|string|null} [data.maxPoints] minPoints must not exceed it
     * @param {string|null} [data.function]
     * @param {{points: number, description: string}[]} [data.scoringOptions] stored in array order
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored criterion with its scoring options
     */
    async createCriterion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "versionNumber"});
        }
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
     * @param {string} data.versionNumber entered by the user, unique within the group
     * @param {...*} [data] the criterion properties of `criterionCreate`; required unless copied
     * @param {Object} options socket options with the transaction
     * @returns {Promise<Object>} the stored criterion with its scoring options
     */
    async createCriterionVersion(data, options) {
        await this.assertDashboardAccess();
        if (!isObject(data)) {
            throw new TranslatableError("errors.assessment.criterion.groupNotFound");
        }
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
                function: original.function,
                subjective: original.subjective,
                expertLevel: original.expertLevel,
                scoringOptions: original.scoringOptions.map(({points, description}) => ({points, description})),
            };
            source = {...copied};
            for (const key of Object.keys(copied)) {
                if (has(data, key)) {
                    source[key] = data[key];
                }
            }
            source.versionNumber = data.versionNumber;
        } else if (groupId === null) {
            throw new TranslatableError("errors.assessment.fieldRequired", {field: "criterionGroupId"});
        } else if (!(await criterion.findOne({where: {criterionGroupId: groupId}, attributes: ["id"], transaction}))) {
            throw new TranslatableError("errors.assessment.criterion.groupNotFound");
        }

        return await this.insertVersion(source, groupId, options);
    }

    /**
     * Permanently deletes one criterion version and its scoring options. Refused while a rubric
     * version references it; other versions of the group are untouched.
     *
     * @socketEvent criterionDelete
     * @param {Object} data
     * @param {number} data.criterionId id of the criterion version
     * @param {Object} options socket options with the transaction
     * @returns {Promise<{id: number, criterionGroupId: number}>} the deleted version
     */
    async deleteCriterion(data, options) {
        await this.assertDashboardAccess();
        const criterionId = positiveInt(isObject(data) ? data.criterionId : null);
        const transaction = options.transaction;
        const {criterion, rubric_criterion: rubricCriterion} = this.models;

        const row = criterionId ? await criterion.findByPk(criterionId, {transaction}) : null;
        if (!row) {
            throw new TranslatableError("errors.assessment.criterion.notFound");
        }

        const inUseError = (rubricIds) => new TranslatableError("errors.assessment.criterion.inUse", {
            criterionId,
            count: rubricIds.length,
            rubricIds: rubricIds.join(", "),
        });
        const references = await rubricCriterion.findAll({
            where: {criterionId}, attributes: ["rubricId"], order: [["rubricId", "ASC"]], transaction,
        });
        if (references.length) {
            throw inUseError(references.map((reference) => reference.rubricId));
        }

        try {
            // scoring options go with it (ON DELETE CASCADE)
            await criterion.destroy({where: {id: criterionId}, transaction});
        } catch (error) {
            // a rubric linked it after the check above: the RESTRICT foreign key is the final guard
            if (error instanceof ForeignKeyConstraintError) {
                throw new TranslatableError("errors.assessment.criterion.inUse", {criterionId, count: 1, rubricIds: "?"});
            }
            throw error;
        }
        return {id: row.id, criterionGroupId: row.criterionGroupId};
    }

    init() {
        this.createSocket("criterionGetAll", this.getAllCriteria, {}, false);
        this.createSocket("criterionGet", this.getCriterion, {}, false);
        this.createSocket("criterionCreate", this.createCriterion, {}, true);
        this.createSocket("criterionCreateVersion", this.createCriterionVersion, {}, true);
        this.createSocket("criterionDelete", this.deleteCriterion, {}, true);
    }
}

module.exports = CriterionSocket;
