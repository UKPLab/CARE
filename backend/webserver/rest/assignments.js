'use strict';

/**
 * Assignments (the `assignment` table, which collects submissions), for /rest/v1/assignments.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const {Op} = require('sequelize');
const {canOf, countActive, findActive} = require('../utils/restHelpers');
const {listRoles, loadUsersByIds} = require('./users');
const {userCanUseProject, defaultProjectFor} = require('./projects');

const ASSIGNMENTS_VIEW_ALL = 'frontend.dashboard.assignments.viewAll';
const ASSIGNMENTS_EDIT_ALL = 'frontend.dashboard.assignments.edit';
const ASSIGNMENT_WRITABLE_FIELDS = [
    'name', 'description', 'projectId', 'start', 'end', 'maxRevisions', 'validationConfigurationId',
    'allowReUpload', 'notifyOnSubmissionUpload', 'submissionWarning',
];
const ASSIGNMENT_PUBLIC_FIELDS = ['id', 'userId', ...ASSIGNMENT_WRITABLE_FIELDS, 'closed', 'createdAt', 'updatedAt'];

/**
 * Share rows of several assignments in one query, as {roles, users} per assignment id.
 *
 * @param {Object} models the database models
 * @param {number[]} assignmentIds the assignment ids
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Map>} assignment id to {roles: role ids, users: user ids}
 */
async function sharesByAssignment(models, assignmentIds, transaction) {
    const rows = assignmentIds.length === 0 ? [] : await findActive(models['assignment_share'],
        {assignmentId: assignmentIds}, {attributes: ['assignmentId', 'roleId', 'userId'], transaction});
    const shares = new Map(assignmentIds.map((id) => [id, {roles: [], users: []}]));
    for (const row of rows) {
        const entry = shares.get(row.assignmentId);
        if (row.roleId) {
            entry.roles.push(row.roleId);
        }
        if (row.userId) {
            entry.users.push(row.userId);
        }
    }
    return shares;
}

/**
 * The public fields of an assignment plus its share list.
 *
 * @param {Object} row the assignment row or model instance
 * @param {Map} shares the share lists from sharesByAssignment
 * @returns {Object} the assignment as REST returns it
 */
function assignmentWithShares(row, shares) {
    const plain = typeof row.get === 'function' ? row.get({plain: true}) : row;
    const assignment = Object.fromEntries(ASSIGNMENT_PUBLIC_FIELDS.map((key) => [key, plain[key] ?? null]));
    assignment.shareWith = shares.get(plain.id) || {roles: [], users: []};
    return assignment;
}

/**
 * One assignment as REST returns it, with its share list.
 *
 * @param {Object} models the database models
 * @param {Object} row the assignment row or model instance
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object>} the assignment
 */
async function publicAssignment(models, row, transaction) {
    const plain = typeof row.get === 'function' ? row.get({plain: true}) : row;
    return assignmentWithShares(plain, await sharesByAssignment(models, [plain.id], transaction));
}

/**
 * Whether the caller may see one assignment: own, shared with them by user or role, or viewAll.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Object} assignment the assignment row
 * @param {Function} can checks a right of the token
 * @returns {Promise<boolean>}
 */
async function canSeeAssignment(models, userId, assignment, can) {
    if (assignment.userId === userId || await can(ASSIGNMENTS_VIEW_ALL)) {
        return true;
    }
    const filter = await models['assignment'].getUserFilter(userId);
    return Boolean(filter.shared && filter.shared.id[Op.in].includes(assignment.id));
}

/**
 * Load an assignment the caller may change: their own, or any with assignments.edit on the token.
 *
 * @param {Object} options the REST options (models, transaction, can)
 * @param {number} userId the token owner's user id
 * @param {number} id the assignment id
 * @returns {Promise<Object|null>} the assignment, or null when it does not exist
 * @throws {TranslatableError} errors.rest.assignmentNoAccess
 */
async function loadAssignmentForChange(options, userId, id) {
    const assignment = await options.models['assignment'].getById(id, {transaction: options.transaction});
    if (!assignment) {
        return null;
    }
    if (assignment.userId !== userId && !(await canOf(options)(ASSIGNMENTS_EDIT_ALL))) {
        throw new TranslatableError('errors.rest.assignmentNoAccess');
    }
    return assignment;
}

/**
 * Turn {roles: [id or name], users: [id]} into role ids and user ids, checking each exists.
 *
 * @param {Object} models the database models
 * @param {Object} shareWith the share list from the request
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object>} {roleIds, userIds}
 * @throws {TranslatableError} errors.rest.roleNotFound or errors.rest.reviewerNotFound
 */
async function resolveShares(models, shareWith, transaction) {
    const roleRows = await listRoles({models, transaction});
    const roleIds = [];
    for (const key of shareWith.roles || []) {
        const role = roleRows.find((row) => row.id === key || row.name === key);
        if (!role) {
            throw new TranslatableError('errors.rest.roleNotFound', {role: key});
        }
        roleIds.push(role.id);
    }
    const userIds = [...new Set(shareWith.users || [])];
    await loadUsersByIds(models, userIds, transaction);
    return {roleIds: [...new Set(roleIds)], userIds};
}

/**
 * Make the share rows of an assignment match the given roles and users. Mirrors the share step
 * of AssignmentModal.vue (assignment_share rows with a roleId or a userId).
 *
 * @param {Object} models the database models
 * @param {number} assignmentId the assignment id
 * @param {Object} shareWith the share list from the request
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<void>}
 */
async function replaceShares(models, assignmentId, shareWith, transaction) {
    const {roleIds, userIds} = await resolveShares(models, shareWith, transaction);
    const existing = await findActive(models['assignment_share'], {assignmentId}, {transaction});
    for (const row of existing) {
        const keep = row.roleId ? roleIds.includes(row.roleId) : userIds.includes(row.userId);
        if (!keep) {
            await models['assignment_share'].deleteById(row.id, {transaction});
        }
    }
    for (const roleId of roleIds.filter((id) => !existing.some((row) => row.roleId === id))) {
        await models['assignment_share'].add({assignmentId, roleId, userId: null}, {transaction});
    }
    for (const userId of userIds.filter((id) => !existing.some((row) => row.userId === id))) {
        await models['assignment_share'].add({assignmentId, userId, roleId: null}, {transaction});
    }
}

/**
 * Project and validation configuration of an assignment must exist; the project must be usable.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Object} fields the assignment fields from the request
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<void>}
 * @throws {TranslatableError} errors.rest.invalidProjectId or errors.rest.invalidValidationConfiguration
 */
async function checkAssignmentReferences(models, userId, fields, transaction) {
    if (fields.projectId != null && !(await userCanUseProject(models, userId, fields.projectId))) {
        throw new TranslatableError('errors.rest.invalidProjectId');
    }
    if (fields.validationConfigurationId != null) {
        const configuration = await models['configuration'].getById(fields.validationConfigurationId, {transaction});
        if (!configuration || configuration.type !== 1) {
            throw new TranslatableError('errors.rest.invalidValidationConfiguration');
        }
    }
}

/**
 * Own assignments, those shared with the caller, or all with viewAll on the token.
 * Mirrors the Assignments dashboard list (assignment table with Assignment.getUserFilter).
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the assignments
 */
async function listAssignments({userId}, options) {
    const models = options.models;
    let where = {};
    if (!(await canOf(options)(ASSIGNMENTS_VIEW_ALL))) {
        const filter = await models['assignment'].getUserFilter(userId);
        where = {[Op.or]: [filter.owned, ...(filter.shared ? [filter.shared] : [])]};
    }
    const rows = await findActive(models['assignment'], where, {order: [['id', 'ASC']]});
    const shares = await sharesByAssignment(models, rows.map((row) => row.id));
    return rows.map((row) => assignmentWithShares(row, shares));
}

/**
 * One assignment the caller may see.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the assignment id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Object|null>} the assignment, or null when it does not exist
 * @throws {TranslatableError} errors.rest.assignmentNoAccess
 */
async function getAssignment({userId, id}, options) {
    const assignment = await options.models['assignment'].getById(id);
    if (!assignment) {
        return null;
    }
    if (!(await canSeeAssignment(options.models, userId, assignment, canOf(options)))) {
        throw new TranslatableError('errors.rest.assignmentNoAccess');
    }
    return publicAssignment(options.models, assignment);
}

/**
 * Mirrors AssignmentModal.vue save (appDataUpdate on assignment, then assignment_share).
 * Differs: the owner is always the token's user; project and configuration are checked.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} data.fields the assignment fields
 * @param {Object} [data.shareWith] roles and users to share with
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new assignment
 */
async function addAssignment({userId, fields, shareWith}, options) {
    const models = options.models;
    // The dashboard creates an assignment inside the current project; REST uses the same default.
    if (fields.projectId === undefined) {
        fields = {...fields, projectId: await defaultProjectFor(models, userId)};
    }
    await checkAssignmentReferences(models, userId, fields, options.transaction);
    const assignment = await models['assignment'].add({...fields, userId}, {transaction: options.transaction});
    if (shareWith) {
        await replaceShares(models, assignment.id, shareWith, options.transaction);
    }
    return publicAssignment(models, assignment, options.transaction);
}

/**
 * Change fields and, when given, the whole share list. Own assignments, or any with
 * assignments.edit on the token. Mirrors AssignmentModal.vue edit.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the assignment id
 * @param {Object} data.fields the fields to change
 * @param {Object} [data.shareWith] roles and users to share with, replacing the current list
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the updated assignment, or null when it does not exist
 */
async function updateAssignment({userId, id, fields, shareWith}, options) {
    const models = options.models;
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    await checkAssignmentReferences(models, userId, fields, options.transaction);
    if (Object.keys(fields).length > 0) {
        await models['assignment'].updateById(assignment.id, fields, {transaction: options.transaction});
    }
    if (shareWith) {
        await replaceShares(models, assignment.id, shareWith, options.transaction);
    }
    return publicAssignment(models, await models['assignment'].getById(assignment.id, {transaction: options.transaction}), options.transaction);
}

/**
 * Close an assignment: no more uploads. Mirrors the close action in Assignments.vue.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the assignment id
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the closed assignment, or null when it does not exist
 * @throws {TranslatableError} errors.rest.assignmentAlreadyClosed
 */
async function closeAssignment({userId, id}, options) {
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    if (assignment.closed) {
        throw new TranslatableError('errors.rest.assignmentAlreadyClosed');
    }
    const updated = await options.models['assignment'].updateById(assignment.id, {closed: new Date()}, {transaction: options.transaction});
    return publicAssignment(options.models, updated, options.transaction);
}

/**
 * Soft-delete an assignment that has no submissions, so no student work loses its assignment.
 * Mirrors the delete action in Assignments.vue. Differs: refused while submissions exist.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the assignment id
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 * @throws {TranslatableError} errors.rest.assignmentHasSubmissions
 */
async function deleteAssignment({userId, id}, options) {
    const models = options.models;
    const assignment = await loadAssignmentForChange(options, userId, id);
    if (!assignment) {
        return null;
    }
    const submissions = await countActive(models['submission'], {assignmentId: assignment.id}, {transaction: options.transaction});
    if (submissions > 0) {
        throw new TranslatableError('errors.rest.assignmentHasSubmissions');
    }
    await models['assignment'].deleteById(assignment.id, {transaction: options.transaction});
    return true;
}

module.exports = {
    ASSIGNMENTS_VIEW_ALL,
    ASSIGNMENT_WRITABLE_FIELDS,
    addAssignment,
    canSeeAssignment,
    closeAssignment,
    deleteAssignment,
    getAssignment,
    listAssignments,
    updateAssignment,
};
