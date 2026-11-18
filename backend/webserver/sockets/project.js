'use strict';

/**
 * Project actions for /rest/v1 only. There is no socket class for this resource yet: the dashboard
 * reads it through the generic table socket. If one is added, it goes in this file below these functions.
 */

const {Op} = require('sequelize');
const TranslatableError = require('../../utils/TranslatableError');
const {pickFields} = require('../utils/restHelpers');

const PROJECT_PUBLIC_FIELDS = ['id', 'name', 'description', 'userId', 'public', 'closed', 'createdAt', 'updatedAt'];

function publicProject(project) {
    return pickFields(project, PROJECT_PUBLIC_FIELDS);
}

/**
 * The project new items go into when none is given: the user's own projects.default setting, else
 * the system projects.default. Same rule as the dashboard, which reads the merged setting.
 * @returns {Promise<number|null>}
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
 * @returns {Promise<Object|null>} null when it does not exist
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
 */
async function createProject({userId, name, description}, options) {
    return options.models['project'].add({name, description: description ?? '', userId, public: false},
        {transaction: options.transaction});
}

/**
 * Change name, description, closed, or public of an own project. Publishing cannot be undone, as in
 * the dashboard. Mirrors appDataUpdate on project.
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
 */
async function listProjects({userId}, options) {
    const projects = await options.models['project'].findAll({
        where: {deleted: false, [Op.or]: [{userId}, {public: true}]},
        attributes: ['id', 'name', 'description', 'public', 'userId', 'closed', 'createdAt', 'updatedAt'],
        order: [['id', 'ASC']],
        raw: true,
    });
    return projects;
}

/**
 * One project the caller may see: their own or a public one.
 * @returns {Promise<Object|null>} null when it does not exist
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

module.exports = {userCanUseProject, defaultProjectFor, listProjects, getProject, publicProject, createProject, updateProject, deleteProject};
