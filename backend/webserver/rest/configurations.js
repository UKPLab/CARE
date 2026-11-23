'use strict';

/**
 * Configurations (assessment rubrics, validation schemas, dialogue plans), for /rest/v1/configurations.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const {Op, literal, where: sqlWhere} = require('sequelize');
const {canOf, pickFields} = require('../utils/restHelpers');

const CONFIGURATIONS_MANAGE = "frontend.dashboard.configurations.manage";
const CONFIGURATION_TYPES = {assessment: 0, validation: 1, dialoguePlan: 2};
const CONFIGURATION_PUBLIC_FIELDS = [
    "id", "name", "description", "type", "userId", "hideInFrontend", "content", "createdAt", "updatedAt",
];

/**
 * The configuration fields REST returns.
 *
 * @param {Object} configuration the configuration row
 * @returns {Object} the public fields
 */
function publicConfiguration(configuration) {
    return pickFields(configuration, CONFIGURATION_PUBLIC_FIELDS);
}

/**
 * Whether a value is a plain object (not null, not an array).
 *
 * @param {*} value
 * @returns {boolean}
 */
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check configuration content for its type. Assessment: rubrics with criteria, each with a name and
 * minPoints <= maxPoints. Validation: a rules object. Dialogue plan: any object.
 * Other keys are kept as they are, so files exported from the dashboard stay valid.
 *
 * @param {number} type the configuration type (see CONFIGURATION_TYPES)
 * @param {Object} content the configuration content
 * @returns {string|null} an error key, or null when the content fits
 */
function checkConfigurationContent(type, content) {
    if (!isObject(content)) {
        return "errors.rest.invalidConfigurationContent";
    }
    const isScore = (value) => typeof value === "number" && Number.isFinite(value);
    const pointsOk = (item) => isScore(item.minPoints) && isScore(item.maxPoints) && item.minPoints <= item.maxPoints;
    if (type === CONFIGURATION_TYPES.assessment) {
        if (!Array.isArray(content.rubrics) || content.rubrics.length === 0) {
            return "errors.rest.invalidConfigurationContent";
        }
        for (const rubric of content.rubrics) {
            if (!isObject(rubric) || typeof rubric.name !== "string" || !rubric.name
                || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
                return "errors.rest.invalidConfigurationContent";
            }
            for (const criterion of rubric.criteria) {
                if (!isObject(criterion) || typeof criterion.name !== "string" || !criterion.name || !pointsOk(criterion)) {
                    return "errors.rest.invalidConfigurationContent";
                }
            }
        }
    }
    if (type === CONFIGURATION_TYPES.validation && !isObject(content.rules)) {
        return "errors.rest.invalidConfigurationContent";
    }
    return null;
}

/**
 * Configurations the caller may read: not hidden, or their own. Configurations are a public table in
 * the dashboard too.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the configurations
 */
async function listConfigurations({userId}, options) {
    const rows = await options.models["configuration"].findAll({
        where: {deleted: false, [Op.or]: [{hideInFrontend: {[Op.not]: true}}, {userId}]},
        order: [["id", "ASC"]],
        raw: true,
    });
    return rows.map(publicConfiguration);
}

/**
 * One configuration the caller may read: not hidden, or their own.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the configuration id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object|null>} the configuration, or null when it does not exist
 * @throws {TranslatableError} errors.rest.configurationNoAccess
 */
async function getConfiguration({userId, id}, options) {
    const row = await options.models["configuration"].getById(id);
    if (!row) {
        return null;
    }
    if (row.hideInFrontend && row.userId !== userId) {
        throw new TranslatableError("errors.rest.configurationNoAccess");
    }
    return publicConfiguration(row);
}

/**
 * Load an own configuration for a change. Needs the manage right on the token.
 *
 * @param {Object} options the REST options (models, transaction, can)
 * @param {number} userId the token owner's user id
 * @param {number} id the configuration id
 * @returns {Promise<Object|null>} the configuration, or null when it does not exist
 * @throws {TranslatableError} errors.rest.missingTokenRight or errors.rest.configurationNoAccess
 */
async function loadOwnConfiguration(options, userId, id) {
    if (!(await canOf(options)(CONFIGURATIONS_MANAGE))) {
        throw new TranslatableError("errors.rest.missingTokenRight");
    }
    const row = await options.models["configuration"].getById(id, {transaction: options.transaction});
    if (!row) {
        return null;
    }
    if (row.userId !== userId) {
        throw new TranslatableError("errors.rest.configurationNoAccess");
    }
    return row;
}

/**
 * Mirrors ConfigurationSocket.createConfiguration (configurationAdd). Differs: needs the manage right
 * instead of admin, and the content is checked for its type.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {string} data.name the configuration name
 * @param {string} [data.description] the description
 * @param {number} data.type the configuration type
 * @param {Object} data.content the configuration content
 * @param {boolean} [data.hideInFrontend] hide it from other users
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object>} the new configuration
 * @throws {TranslatableError} errors.rest.missingTokenRight or errors.rest.invalidConfigurationContent
 */
async function createConfiguration({userId, name, description, type, content, hideInFrontend}, options) {
    if (!(await canOf(options)(CONFIGURATIONS_MANAGE))) {
        throw new TranslatableError("errors.rest.missingTokenRight");
    }
    const problem = checkConfigurationContent(type, content);
    if (problem) {
        throw new TranslatableError(problem);
    }
    const row = await options.models["configuration"].add({
        name, description: description ?? "", userId, type, content, hideInFrontend: hideInFrontend === true,
    }, {transaction: options.transaction});
    return publicConfiguration(row);
}

/**
 * Mirrors ConfigurationSocket.updateConfiguration (configurationUpdate). Differs: own configurations
 * only, needs the manage right, and name, description, and hideInFrontend can change too.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the configuration id
 * @param {Object} data.fields the fields to change
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the updated configuration, or null when it does not exist
 * @throws {TranslatableError} errors.rest.invalidConfigurationContent
 */
async function updateConfiguration({userId, id, fields}, options) {
    const row = await loadOwnConfiguration(options, userId, id);
    if (!row) {
        return null;
    }
    if (fields.content !== undefined) {
        const problem = checkConfigurationContent(row.type, fields.content);
        if (problem) {
            throw new TranslatableError(problem);
        }
    }
    const updated = await options.models["configuration"].updateById(row.id, fields, {transaction: options.transaction});
    return publicConfiguration(updated);
}

/**
 * Soft-delete an own configuration that nothing uses: no assignment or submission validates
 * against it and no study step assesses with it.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the configuration id
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 * @throws {TranslatableError} errors.rest.configurationInUse
 */
async function deleteConfiguration({userId, id}, options) {
    const models = options.models;
    const row = await loadOwnConfiguration(options, userId, id);
    if (!row) {
        return null;
    }
    const transaction = options.transaction;
    const usedByAssignments = await models["assignment"].count({where: {validationConfigurationId: row.id, deleted: false}, transaction});
    const usedBySubmissions = await models["submission"].count({where: {validationConfigurationId: row.id, deleted: false}, transaction});
    const usedBySteps = await models["study_step"].count({
        where: {
            deleted: false,
            [Op.and]: [sqlWhere(literal(models["study_step"].assessmentConfigurationSql("study_step")), String(row.id))],
        },
        transaction,
    });
    if (usedByAssignments + usedBySubmissions + usedBySteps > 0) {
        throw new TranslatableError("errors.rest.configurationInUse");
    }
    await models["configuration"].deleteById(row.id, {transaction});
    return true;
}

module.exports = {
    CONFIGURATION_TYPES,
    createConfiguration,
    deleteConfiguration,
    getConfiguration,
    listConfigurations,
    updateConfiguration,
};
