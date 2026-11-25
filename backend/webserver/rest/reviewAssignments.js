'use strict';

/**
 * Review assignments, part 3: the entry point for POST /rest/v1/review-assignments, reviewer sessions, and emails.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const _ = require("lodash");
const {ASSIGNMENT_MODES, ASSIGNMENT_TYPES, loadAssignmentItems, loadRoleGroups, loadTemplateForAssignment, planByReviewer, planByRole} = require('./reviewAssignmentPlans');
const {canOf, countActive} = require('../utils/restHelpers');
const {loadUsersByIds} = require('./users');
const {createAssignmentStudy, itemStepDocuments} = require('./reviewAssignmentStudies');
const {getEmailContent} = require('../../utils/helper/email');
const {userCanViewStudy} = require('./studies');

/**
 * One study session per reviewer. Raises the study's session limit when it would be exceeded.
 * Mirrors AssignmentSocket.addReviewer (assignmentAdd). Differs: a null limit stays unlimited.
 *
 * @param {Object} study the study row
 * @param {number[]} reviewerIds the reviewer user ids
 * @param {Object} options the REST options (models, transaction)
 * @param {Object} [flags]
 * @param {boolean} [flags.fresh] the study was created in this request, so its limit already fits
 * @returns {Promise<Array<Object>>} the new sessions
 */
async function addReviewerSessions(study, reviewerIds, options, {fresh = false} = {}) {
    const models = options.models;
    const transaction = options.transaction;
    // 0 and null both mean unlimited, as in the session model's check. A study created in this
    // request was made with room for exactly these reviewers, so it needs no count.
    if (!fresh && study.limitSessions > 0) {
        const existing = await countActive(models['study_session'], {studyId: study.id}, {transaction});
        if (existing + reviewerIds.length > study.limitSessions) {
            await models['study'].updateById(study.id, {limitSessions: existing + reviewerIds.length}, {transaction});
        }
    }
    const sessions = [];
    for (const reviewerId of reviewerIds) {
        sessions.push(await models['study_session'].add({studyId: study.id, userId: reviewerId}, {transaction}));
    }
    return sessions;
}

/**
 * Mirrors AssignmentSocket.sendAssignmentEmail.
 *
 * @param {Object} session the reviewer's study session
 * @param {Object} study the study row
 * @param {string} type the item type, for the email text
 * @param {Object} options the REST options (models, server, logger)
 * @returns {Promise<void>}
 */
async function sendAssignmentEmail(session, study, type, options) {
    const models = options.models;
    const user = await models['user'].getById(session.userId);
    if (!user || !user.email) {
        options.logger.warn(`Cannot send assignment email: user ${session.userId} has no email`);
        return;
    }
    const baseUrl = await models['setting'].get('system.baseUrl') || 'localhost:3000';
    const content = await getEmailContent('email.template.assignment', 'assignment', {
        userId: session.userId,
        creatorId: study.userId,
        studyId: study.id,
        studySessionId: session.id,
        studySessionHash: session.hash,
        baseUrl,
        link: `http://${baseUrl}/session/${session.hash}`,
        assignmentType: type,
        assignmentName: study.name,
    }, models, options.logger);
    await options.server.sendMail(user.email, content.subject, content.body, {isHtml: content.isHtml});
}

/**
 * One created or extended study as REST returns it.
 *
 * @param {Object} study the study row
 * @param {number|null} itemId the reviewed item, or null when reviewers were added to a study
 * @param {Array<Object>} sessions the reviewer sessions
 * @returns {Object} {id, hash, name, itemId, sessions}
 */
function assignmentResult(study, itemId, sessions) {
    return {
        id: study.id,
        hash: study.hash,
        name: study.name,
        itemId,
        sessions: sessions.map((session) => ({id: session.id, hash: session.hash, userId: session.userId})),
    };
}

/**
 * Create review assignments, or add reviewers to an existing study. One function for what the
 * dashboard does with assignmentCreateSingle, assignmentCreateBulk, and assignmentAdd.
 * Mirrors AssignmentSocket.createAssignmentSingle, createAssignmentBulk and addReviewer (assignmentCreateSingle,
 * assignmentCreateBulk, assignmentAdd). Differs: ids only, rows loaded and checked here.
 *
 * With `studyId`: add one session per reviewer to that study.
 * With `templateId`: create one study per item from the template, then add the reviewer sessions.
 *   mode 'everyReviewer' every item is reviewed by every reviewer (one item is the single assignment)
 *   mode 'byRole'        every user of each role reviews `roles[role]` items
 *   mode 'byCount'       each item goes to one reviewer, `counts[userId]` items per reviewer
 *   mode 'sessionOwner'  each study session goes back to its own user (type 'study_session' only)
 * The route turns the request's lists into the maps `roles` {roleNameOrId: items} and
 * `counts` {userId: items}.
 * With `dryRun` nothing is written and the planned distribution is returned.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} [data.studyId] the study to add reviewers to
 * @param {number} [data.templateId] the template to create studies from
 * @param {string} [data.type] the item type, 'document' by default
 * @param {string} [data.mode] the assignment mode, 'everyReviewer' by default
 * @param {number[]} [data.itemIds] the items to review
 * @param {number[]} [data.reviewerIds] the reviewers
 * @param {Object} [data.roles] role to items per user, for 'byRole'
 * @param {Object} [data.counts] user id to items, for 'byCount'
 * @param {Object} [data.workflowMapping] the step mapping, for study sessions
 * @param {boolean} [data.notify] email the reviewers after commit
 * @param {boolean} [data.dryRun] only return the plan
 * @param {Object} options the REST options (models, transaction, can, server, logger)
 * @returns {Promise<Object>} {dryRun, plan} for a dry run, otherwise {dryRun, studies}
 */
async function createReviewAssignments(data, options) {
    const models = options.models;
    const transaction = options.transaction;
    const {userId, type = 'document', mode = 'everyReviewer', notify = false, dryRun = false} = data;
    const reviewerIds = [...new Set(data.reviewerIds || [])];
    // Rights come from the API token, never from the owner alone.
    const can = canOf(options);

    if (data.studyId != null) {
        const study = await models['study'].getById(data.studyId, {transaction});
        if (!study) {
            throw new TranslatableError('errors.rest.studyNotFound');
        }
        if (!(await userCanViewStudy(can, userId, study))) {
            throw new TranslatableError('errors.rest.studyNoAccess');
        }
        if (study.template || study.closed) {
            throw new TranslatableError('errors.rest.studyNotEditable');
        }
        await loadUsersByIds(models, reviewerIds, transaction);
        if (dryRun) {
            return {dryRun: true, plan: [{studyId: study.id, reviewerIds}]};
        }
        const sessions = await addReviewerSessions(study, reviewerIds, options);
        if (notify) {
            // Not returned, so the answer does not wait for mail delivery. Failures are logged.
            transaction.afterCommit(() => {
                (async () => {
                    for (const session of sessions) {
                        await sendAssignmentEmail(session, study, 'document', options)
                            .catch((error) => options.logger.error('Failed to send assignment email: ' + error));
                    }
                })();
            });
        }
        return {dryRun: false, studies: [assignmentResult(study, null, sessions)]};
    }

    if (!ASSIGNMENT_TYPES.includes(type) || !ASSIGNMENT_MODES.includes(mode)
        || (mode === 'sessionOwner' && type !== 'study_session')) {
        throw new TranslatableError('errors.assignment.invalidMode');
    }
    const template = await loadTemplateForAssignment(models, userId, data.templateId, transaction, can);
    const items = _.shuffle(await loadAssignmentItems(models, userId, type, [...new Set(data.itemIds)], transaction, can));

    let plan;
    if (mode === 'byRole') {
        plan = planByRole(items, await loadRoleGroups(models, data.roles, reviewerIds, transaction, can));
    } else if (mode === 'byCount') {
        await loadUsersByIds(models, Object.keys(data.counts).map(Number), transaction);
        plan = planByReviewer(items, data.counts);
    } else if (mode === 'sessionOwner') {
        plan = items.map((item) => ({item, reviewerIds: [item.userId]}));
    } else {
        await loadUsersByIds(models, reviewerIds, transaction);
        plan = items.map((item) => ({item, reviewerIds}));
    }
    if (dryRun) {
        return {
            dryRun: true,
            plan: plan.map((entry) => ({itemId: entry.item.id, reviewerIds: entry.reviewerIds})),
        };
    }

    const templateSteps = await models['study_step'].getAllByKey('studyId', template.id) || [];
    const workflowSteps = await models['workflow_step'].getSortedWorkflowSteps(template.workflowId);
    const created = [];
    for (const {item, reviewerIds: itemReviewerIds} of plan) {
        const documents = await itemStepDocuments(
            models, userId, type, item, workflowSteps, data.workflowMapping, transaction);
        const study = await createAssignmentStudy({
            userId, template, templateSteps, workflowSteps, type, item, documents,
            reviewerCount: itemReviewerIds.length,
        }, options);
        const sessions = await addReviewerSessions(study, itemReviewerIds, options, {fresh: true});
        created.push({study, itemId: item.id, sessions});
    }
    if (notify) {
        // Not returned, so the answer does not wait for mail delivery. Failures are logged.
        transaction.afterCommit(() => {
            (async () => {
                for (const {study, sessions} of created) {
                    for (const session of sessions) {
                        await sendAssignmentEmail(session, study, type, options)
                            .catch((error) => options.logger.error('Failed to send assignment email: ' + error));
                    }
                }
            })();
        });
    }
    return {
        dryRun: false,
        studies: created.map(({study, itemId, sessions}) => assignmentResult(study, itemId, sessions)),
    };
}

module.exports = {
    createReviewAssignments,
};
