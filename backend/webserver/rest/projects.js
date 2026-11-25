'use strict';

/**
 * Projects, for /rest/v1/projects.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require('../../utils/TranslatableError');
const {Op} = require('sequelize');
const {findActive, pickFields} = require('../utils/restHelpers');

const PROJECT_PUBLIC_FIELDS = ['id', 'name', 'description', 'userId', 'public', 'closed', 'createdAt', 'updatedAt'];

/**
 * The project fields REST returns.
 *
 * @param {Object} project the project row
 * @returns {Object} the public fields
 */
function publicProject(project) {
    return pickFields(project, PROJECT_PUBLIC_FIELDS);
}

/**
 * The project new items go into when none is given: the user's own projects.default setting, else
 * the system projects.default. Same rule as the dashboard, which reads the merged setting.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @returns {Promise<number|null>} the project id, or null when none is set
 */
async function defaultProjectFor(models, userId) {
    const own = parseInt(await models['user_setting'].get('projects.default', userId), 10);
    if (Number.isInteger(own)) {
        return own;
    }
    const system = parseInt(await models['setting'].get('projects.default'), 10);
    return Number.isInteger(system) ? system : null;
}

/**
 * A project the caller owns, for changing it. Others' projects stay a dashboard action.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} id the project id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object|null>} the project, or null when it does not exist
 * @throws {TranslatableError} errors.rest.projectNoAccess
 */
async function loadOwnProject(models, userId, id, transaction) {
    const project = await models['project'].getById(id, {transaction});
    if (!project) {
        return null;
    }
    if (project.userId !== userId) {
        throw new TranslatableError('errors.rest.projectNoAccess');
    }
    return project;
}

/**
 * Mirrors the dashboard's project form (appDataUpdate on project). Differs: owner from the token.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {string} data.name the project name
 * @param {string} [data.description] the description
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new project
 */
async function createProject({userId, name, description}, options) {
    return options.models['project'].add({name, description: description ?? '', userId, public: false},
        {transaction: options.transaction});
}

/**
 * Change name, description, closed, or public of an own project. Publishing cannot be undone, as in
 * the dashboard. Mirrors appDataUpdate on project.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the project id
 * @param {Object} data.fields the fields to change
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the updated project, or null when it does not exist
 * @throws {TranslatableError} errors.rest.projectAlreadyPublic
 */
async function updateProject({userId, id, fields}, options) {
    const project = await loadOwnProject(options.models, userId, id, options.transaction);
    if (!project) {
        return null;
    }
    if (fields.public === false && project.public) {
        throw new TranslatableError('errors.rest.projectAlreadyPublic');
    }
    return options.models['project'].updateById(project.id, fields, {transaction: options.transaction});
}

/**
 * Soft-delete an own project. The project model then deletes its documents and studies too.
 * Mirrors the dashboard's project delete (appDataUpdate with deleted).
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the project id
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 */
async function deleteProject({userId, id}, options) {
    const project = await loadOwnProject(options.models, userId, id, options.transaction);
    if (!project) {
        return null;
    }
    await options.models['project'].deleteById(project.id, {transaction: options.transaction});
    return true;
}

/**
 * A caller may attach a document to a project they own or a public one.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} projectId the project id
 * @returns {Promise<boolean>}
 */
async function userCanUseProject(models, userId, projectId) {
    const project = await models['project'].getById(projectId);
    if (!project || project.deleted) {
        return false;
    }
    return project.public === true || project.userId === userId;
}

/**
 * Projects the caller may put documents in: their own and public ones.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the projects
 */
async function listProjects({userId}, options) {
    const projects = await findActive(options.models['project'], {[Op.or]: [{userId}, {public: true}]}, {
        attributes: ['id', 'name', 'description', 'public', 'userId', 'closed', 'createdAt', 'updatedAt'],
        order: [['id', 'ASC']],
    });
    return projects;
}

/**
 * One project the caller may see: their own or a public one.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the project id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object|null>} the project, or null when it does not exist
 * @throws {TranslatableError} errors.rest.projectNoAccess
 */
async function getProject({userId, id}, options) {
    const project = await options.models['project'].getById(id);
    if (!project) {
        return null;
    }
    if (project.public !== true && project.userId !== userId) {
        throw new TranslatableError('errors.rest.projectNoAccess');
    }
    return project;
}

/**
 * The caller's current project: the one picked in the dashboard's project picker (their
 * projects.default setting), else the system default. New tag sets go there, and documents,
 * assignments, and submissions sent without a project.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object|null>} the project, or null when none is set or it was deleted
 */
async function getCurrentProject({userId}, options) {
    const projectId = await defaultProjectFor(options.models, userId);
    const project = projectId === null ? null : await options.models['project'].getById(projectId);
    return project ? publicProject(project) : null;
}

/**
 * Mirrors the dashboard's project picker (appSettingSet with projects.default). Differs: the
 * project must exist and be the caller's own or a public one, the same rule as everywhere else.
 * An open dashboard shows the change after a reload, because user settings are not broadcast.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.projectId the project to make current
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new current project
 * @throws {TranslatableError} errors.rest.invalidProjectId
 */
async function setCurrentProject({userId, projectId}, options) {
    const models = options.models;
    if (!(await userCanUseProject(models, userId, projectId))) {
        throw new TranslatableError('errors.rest.invalidProjectId');
    }
    await models['user_setting'].set('projects.default', projectId, userId, {transaction: options.transaction});
    return publicProject(await models['project'].getById(projectId, {transaction: options.transaction}));
}

module.exports = {
    createProject,
    defaultProjectFor,
    deleteProject,
    getCurrentProject,
    getProject,
    listProjects,
    publicProject,
    setCurrentProject,
    updateProject,
    userCanUseProject,
};
