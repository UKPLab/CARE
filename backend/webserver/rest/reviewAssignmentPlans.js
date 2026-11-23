'use strict';

/**
 * Review assignments, part 1: load the template, items, and reviewers, and plan who reviews what.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const _ = require("lodash");
const {ASSIGNMENTS_VIEW_ALL} = require('./assignments');

const ASSIGNMENT_TYPES = ['document', 'submission', 'study_session'];
const ASSIGNMENT_MODES = ['everyReviewer', 'byRole', 'byCount', 'sessionOwner'];
const ITEM_MODEL = {document: 'document', submission: 'submission', study_session: 'study_session'};

/**
 * Load the study template review studies are created from. The caller must be allowed to see it.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} templateId the template id
 * @param {Object} [transaction] the Sequelize transaction
 * @param {Function} can checks a right of the token
 * @returns {Promise<Object>} the template
 * @throws {TranslatableError} errors.rest.templateNotFound, errors.rest.studyNoAccess, or errors.rest.notAStudyTemplate
 */
async function loadTemplateForAssignment(models, userId, templateId, transaction, can) {
    const {userCanViewStudy} = require('./studies');
    const template = await models['study'].getById(templateId, {transaction});
    if (!template) {
        throw new TranslatableError('errors.rest.templateNotFound');
    }
    if (!(await userCanViewStudy(can, userId, template))) {
        throw new TranslatableError('errors.rest.studyNoAccess');
    }
    if (!template.template) {
        throw new TranslatableError('errors.rest.notAStudyTemplate');
    }
    return template;
}

/**
 * Load the documents, submissions, or study sessions to assign. Same visibility as the Assignments view.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {string} type the item type (see ASSIGNMENT_TYPES)
 * @param {number[]} itemIds the item ids, in the order the caller sent them
 * @param {Object} [transaction] the Sequelize transaction
 * @param {Function} can checks a right of the token
 * @returns {Promise<Array<Object>>} the items
 * @throws {TranslatableError} errors.rest.assignmentItemNotFound or errors.rest.assignmentItemNoAccess
 */
async function loadAssignmentItems(models, userId, type, itemIds, transaction, can) {
    const {userHasDocumentAccess} = require('./documents');
    const {userCanViewStudy} = require('./studies');
    const seeAll = await can(ASSIGNMENTS_VIEW_ALL);
    // One query for all items; the checks below still go in the order the caller sent them.
    const rows = await models[ITEM_MODEL[type]].findAll({where: {id: itemIds, deleted: false}, raw: true, transaction});
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = [];
    for (const id of itemIds) {
        const item = byId.get(id);
        if (!item) {
            throw new TranslatableError('errors.rest.assignmentItemNotFound', {id});
        }
        let allowed = seeAll;
        if (!allowed && type === 'document') {
            allowed = await userHasDocumentAccess(models, userId, item.id, can);
        } else if (!allowed && type === 'submission') {
            allowed = item.userId === userId;
        } else if (!allowed) {
            const study = await models['study'].getById(item.studyId, {transaction});
            allowed = await userCanViewStudy(can, userId, study);
        }
        if (!allowed) {
            throw new TranslatableError('errors.rest.assignmentItemNoAccess', {id});
        }
        items.push(item);
    }
    return items;
}

/**
 * Load the reviewers by id. Each one must exist and not be deleted.
 *
 * @param {Object} models the database models
 * @param {number[]} reviewerIds the reviewer user ids
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Array<Object>>} the reviewers (id, firstName, lastName)
 * @throws {TranslatableError} errors.rest.reviewerNotFound
 */
async function loadReviewers(models, reviewerIds, transaction) {
    if (reviewerIds.length === 0) {
        return [];
    }
    const users = await models['user'].findAll({
        where: {id: reviewerIds, deleted: false},
        attributes: ['id', 'firstName', 'lastName'],
        raw: true,
        transaction,
    });
    for (const id of reviewerIds) {
        if (!users.some((user) => user.id === id)) {
            throw new TranslatableError('errors.rest.reviewerNotFound', {id});
        }
    }
    return users;
}

/**
 * Resolve { roleIdOrName: reviewsPerUser } to the users of each role.
 * Listing a role's users needs the same right the dashboard user list needs.
 *
 * @param {Object} models the database models
 * @param {Object} roles role id or name to the number of reviews per user
 * @param {number[]} reviewerIds when not empty, only these users are taken from each role
 * @param {Object} [transaction] the Sequelize transaction
 * @param {Function} can checks a right of the token
 * @returns {Promise<Array<Object>>} one {roleName, needed, users} per role
 * @throws {TranslatableError} errors.rest.roleNotFound or errors.rest.roleNoAccess
 */
async function loadRoleGroups(models, roles, reviewerIds, transaction, can) {
    const allRoles = await models['user_role'].findAll({attributes: ['id', 'name'], raw: true, transaction});
    const groups = [];
    for (const [key, needed] of Object.entries(roles)) {
        if (needed === 0) {
            continue;
        }
        const role = allRoles.find((row) => String(row.id) === key || row.name === key);
        if (!role) {
            throw new TranslatableError('errors.rest.roleNotFound', {role: key});
        }
        const mayList = await can(`backend.socket.user.getUsers.${role.name}`)
            || await can('backend.socket.user.getUsers.all');
        if (!mayList) {
            throw new TranslatableError('errors.rest.roleNoAccess', {role: role.name});
        }
        const matches = await models['user_role_matching'].findAll({
            where: {userRoleId: role.id, deleted: false},
            attributes: ['userId'],
            raw: true,
            transaction,
        });
        let memberIds = [...new Set(matches.map((row) => row.userId))];
        if (reviewerIds.length > 0) {
            memberIds = memberIds.filter((id) => reviewerIds.includes(id));
        }
        const users = memberIds.length === 0 ? [] : await models['user'].findAll({
            where: {id: memberIds, deleted: false},
            attributes: ['id', 'firstName', 'lastName'],
            raw: true,
            transaction,
        });
        groups.push({roleName: role.name, needed, users});
    }
    return groups;
}

/**
 * Every user of each role reviews `needed` items. Nobody reviews their own item, and items are
 * filled evenly. Same rules as assignmentCreateBulk in role mode.
 * Mirrors the role mode of AssignmentSocket.createAssignmentBulk. Rewritten: same rules, different code.
 *
 * @param {Array<Object>} items the items to review
 * @param {Array<Object>} groups the role groups from loadRoleGroups
 * @returns {Array<Object>} one {item, reviewerIds} per item
 * @throws {TranslatableError} when the items cannot be shared out
 */
function planByRole(items, groups) {
    const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
    const counter = Object.fromEntries(items.map((item) => [item.id, 0]));
    const reviewersByItem = {};

    for (const {roleName, needed, users} of groups) {
        const queue = _.shuffle(users);
        if (queue.length === 0) {
            throw new TranslatableError('errors.assignment.noUsersFoundForRole', {roleName});
        }
        if (needed > items.length) {
            throw new TranslatableError('errors.assignment.notEnoughDocumentsForRole', {roleName});
        }
        for (const user of queue) {
            if (items.filter((item) => item.userId !== user.id).length < needed) {
                throw new TranslatableError('errors.assignment.notEnoughDocumentsForReviewer', {
                    reviewerName: `${user.firstName} ${user.lastName}`,
                });
            }
        }

        const assigned = {};
        const fits = (item, user) => item.userId !== user.id && !assigned[user.id].includes(item.id);
        for (const user of queue) {
            assigned[user.id] = [];
            while (assigned[user.id].length < needed) {
                const minCount = Math.min(...Object.values(counter));
                const next = items.find((item) => counter[item.id] === minCount && fits(item, user));
                if (next) {
                    assigned[user.id].push(next.id);
                    counter[next.id]++;
                    continue;
                }
                // No least-reviewed item fits this user. Take a fitting item from an earlier user
                // and give that user a least-reviewed item instead.
                let swapped = false;
                for (const other of queue) {
                    if (other.id === user.id || !assigned[other.id]) {
                        continue;
                    }
                    const takeId = assigned[other.id].find((id) => fits(itemById[id], user));
                    if (takeId === undefined) {
                        continue;
                    }
                    const replacement = items.find((item) =>
                        counter[item.id] === minCount && item.id !== takeId && fits(item, other));
                    if (!replacement) {
                        continue;
                    }
                    assigned[other.id] = assigned[other.id].filter((id) => id !== takeId);
                    assigned[other.id].push(replacement.id);
                    assigned[user.id].push(takeId);
                    counter[replacement.id]++;
                    swapped = true;
                    break;
                }
                if (!swapped) {
                    throw new TranslatableError('errors.assignment.unableToAssignEnoughDocuments', {
                        reviewerName: `${user.firstName} ${user.lastName}`,
                        roleName,
                    });
                }
            }
        }
        for (const [reviewerId, itemIds] of Object.entries(assigned)) {
            for (const itemId of itemIds) {
                (reviewersByItem[itemId] ||= []).push(Number(reviewerId));
            }
        }
    }
    return Object.entries(reviewersByItem).map(([itemId, reviewerIds]) => ({item: itemById[itemId], reviewerIds}));
}

/**
 * Each item goes to exactly one reviewer. `counts` is how many items each reviewer takes.
 * Nobody reviews their own item. Same rules as assignmentCreateBulk in reviewer mode.
 * Mirrors the reviewer mode of AssignmentSocket.createAssignmentBulk. Rewritten: same rules, different code.
 *
 * @param {Array<Object>} items the items to review
 * @param {Object} counts reviewer id to the number of items they take
 * @returns {Array<Object>} one {item, reviewerIds} per item
 * @throws {TranslatableError} errors.assignment.couldNotAssignReviewers
 */
function planByReviewer(items, counts) {
    const remaining = {...counts};
    const taken = Object.fromEntries(Object.keys(counts).map((id) => [id, []]));

    for (const item of items) {
        const free = Object.keys(remaining).find((id) => remaining[id] > 0 && item.userId !== Number(id));
        if (free !== undefined) {
            taken[free].push(item);
            remaining[free]--;
            continue;
        }
        // Only the item's owner has room left. Hand the item to another reviewer and give the owner
        // one of that reviewer's items in exchange.
        const owner = String(item.userId);
        let swapped = false;
        if (remaining[owner] > 0) {
            for (const other of Object.keys(taken)) {
                const give = other === owner ? undefined : taken[other].find((held) => held.userId !== item.userId);
                if (give === undefined) {
                    continue;
                }
                taken[other] = taken[other].filter((held) => held !== give);
                taken[other].push(item);
                taken[owner].push(give);
                remaining[owner]--;
                swapped = true;
                break;
            }
        }
        if (!swapped) {
            throw new TranslatableError('errors.assignment.couldNotAssignReviewers');
        }
    }
    return Object.entries(taken).flatMap(([reviewerId, held]) =>
        held.map((item) => ({item, reviewerIds: [Number(reviewerId)]})));
}

module.exports = {
    ASSIGNMENT_MODES,
    ASSIGNMENT_TYPES,
    loadAssignmentItems,
    loadReviewers,
    loadRoleGroups,
    loadTemplateForAssignment,
    planByReviewer,
    planByRole,
};
