'use strict';

const TranslatableError = require('../../../utils/TranslatableError');
const AssignmentSocket = require('../../sockets/assignment');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, is} = require('./routeHelpers');

const ADD_SINGLE = 'frontend.dashboard.studies.addSingleAssignments';
const ADD_BULK = 'frontend.dashboard.studies.addBulkAssignments';

const {createAssignments, ASSIGNMENT_TYPES, ASSIGNMENT_MODES} = AssignmentSocket;

const NOT_FOUND = new Set([
    'errors.rest.studyNotFound',
    'errors.rest.templateNotFound',
    'errors.rest.assignmentItemNotFound',
    'errors.rest.reviewerNotFound',
    'errors.rest.roleNotFound',
]);
const FORBIDDEN = new Set([
    'errors.rest.missingTokenRight',
    'errors.rest.studyNoAccess',
    'errors.rest.assignmentItemNoAccess',
    'errors.rest.roleNoAccess',
]);

/**
 * @returns {number[]|null} unique integers, or null when the value is not an array of integers
 */
function readIds(raw) {
    if (!Array.isArray(raw) || raw.some((id) => !Number.isInteger(id))) {
        return null;
    }
    return [...new Set(raw)];
}

/**
 * A list like [{"role": "student", "items": 2}] or [{"userId": 7, "items": 2}] as the map the
 * assignment function uses ({"student": 2} or {"7": 2}). Entries with 0 items are dropped.
 * @param {*} raw the request value
 * @param {string} keyName "role" or "userId"
 * @returns {Object|null} null when the shape is wrong, a key repeats, or nothing is left
 */
function readItemsList(raw, keyName) {
    if (!Array.isArray(raw)) {
        return null;
    }
    const map = {};
    for (const entry of raw) {
        if (!is.object(entry) || !Number.isInteger(entry.items) || entry.items < 0) {
            return null;
        }
        const key = entry[keyName];
        const validKey = keyName === 'userId'
            ? Number.isInteger(key)
            : (typeof key === 'string' && key !== '') || Number.isInteger(key);
        if (!validKey || Object.prototype.hasOwnProperty.call(map, String(key))) {
            return null;
        }
        if (entry.items > 0) {
            map[String(key)] = entry.items;
        }
    }
    return Object.keys(map).length > 0 ? map : null;
}

/**
 * { sourceWorkflowStepId: targetWorkflowStepId | "previousSubmission" }
 */
function readWorkflowMapping(raw) {
    if (!is.object(raw) || Object.keys(raw).length === 0) {
        return null;
    }
    for (const [key, value] of Object.entries(raw)) {
        if (!/^\d+$/.test(key) || !(Number.isInteger(value) || value === 'previousSubmission')) {
            return null;
        }
    }
    return raw;
}

/**
 * Turn the request body into the arguments of createAssignments. Only known keys are read.
 * @returns {{error: string}|{data: Object, bulk: boolean}}
 */
function readAssignmentBody(body) {
    if (!is.object(body)) {
        return {error: 'errors.rest.assignmentTargetRequired'};
    }
    for (const flag of ['notify', 'dryRun']) {
        if (body[flag] !== undefined && typeof body[flag] !== 'boolean') {
            return {error: 'errors.rest.invalidAssignmentField'};
        }
    }
    const data = {notify: body.notify === true, dryRun: body.dryRun === true};
    const hasStudy = body.studyId !== undefined && body.studyId !== null;
    const hasTemplate = body.templateId !== undefined && body.templateId !== null;
    if (hasStudy && hasTemplate) {
        return {error: 'errors.rest.assignmentTargetConflict'};
    }
    if (!hasStudy && !hasTemplate) {
        return {error: 'errors.rest.assignmentTargetRequired'};
    }

    let reviewerIds = [];
    if (body.reviewers !== undefined) {
        reviewerIds = readIds(body.reviewers);
        if (!reviewerIds) {
            return {error: 'errors.rest.invalidAssignmentField'};
        }
    }
    data.reviewerIds = reviewerIds;

    if (hasStudy) {
        if (!Number.isInteger(body.studyId)) {
            return {error: 'errors.rest.invalidAssignmentField'};
        }
        if (reviewerIds.length === 0) {
            return {error: 'errors.rest.assignmentReviewersRequired'};
        }
        data.studyId = body.studyId;
        return {data, bulk: false};
    }

    if (!Number.isInteger(body.templateId)) {
        return {error: 'errors.rest.invalidTemplateId'};
    }
    data.templateId = body.templateId;
    data.type = body.type === undefined ? 'document' : body.type;
    data.mode = body.mode === undefined ? 'everyReviewer' : body.mode;
    if (!ASSIGNMENT_TYPES.includes(data.type)) {
        return {error: 'errors.rest.invalidAssignmentType'};
    }
    if (!ASSIGNMENT_MODES.includes(data.mode) || (data.mode === 'sessionOwner' && data.type !== 'study_session')) {
        return {error: 'errors.rest.invalidAssignmentMode'};
    }
    data.itemIds = readIds(body.items);
    if (!data.itemIds || data.itemIds.length === 0) {
        return {error: 'errors.rest.assignmentItemsRequired'};
    }
    if (data.type === 'study_session') {
        data.workflowMapping = readWorkflowMapping(body.workflowMapping);
        if (!data.workflowMapping) {
            return {error: 'errors.rest.invalidWorkflowMapping'};
        }
    }
    if (data.mode === 'everyReviewer' && reviewerIds.length === 0) {
        return {error: 'errors.rest.assignmentReviewersRequired'};
    }
    if (data.mode === 'byRole') {
        data.roles = readItemsList(body.roles, 'role');
        if (!data.roles) {
            return {error: 'errors.rest.assignmentReviewersRequired'};
        }
    }
    if (data.mode === 'byCount') {
        data.counts = readItemsList(body.counts, 'userId');
        if (!data.counts) {
            return {error: 'errors.rest.assignmentReviewersRequired'};
        }
    }
    return {data, bulk: data.mode !== 'everyReviewer' || data.itemIds.length > 1};
}

/**
 * REST review assignments: one route for single, bulk, and add-reviewer. Named review-assignments
 * because the `assignment` table (course tasks with submissions) is a different thing.
 */
function registerRestReviewAssignmentRoutes(server) {
    server.app.post('/rest/v1/review-assignments', heavyRateLimit(server), (req, res) => {
        const parsed = readAssignmentBody(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        return runWrite(server, req, res, {
            status: 201,
            label: 'create assignments',
            errors: {notFound: NOT_FOUND, forbidden: FORBIDDEN},
            // A dry run answers 200 with the plan and keeps nothing.
            dryRun: (body) => body.dryRun === true,
        }, async (options) => {
            // Same split as the dashboard: one right for a single assignment, another for bulk.
            if (!(await options.can(parsed.bulk ? ADD_BULK : ADD_SINGLE))) {
                throw new TranslatableError('errors.rest.missingTokenRight');
            }
            return createAssignments({userId: req.apiUserId, ...parsed.data}, options);
        });
    });
}

module.exports = {registerRestReviewAssignmentRoutes};
