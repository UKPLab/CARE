'use strict';

const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, is} = require('./routeHelpers');
const {requestHasRight} = require('../../middleware/bearerAuth');
const {ASSIGNMENT_TYPES, ASSIGNMENT_MODES} = require('../../rest/reviewAssignmentPlans');
const {createReviewAssignments} = require('../../rest/reviewAssignments');

const ADD_SINGLE = 'frontend.dashboard.studies.addSingleAssignments';
const ADD_BULK = 'frontend.dashboard.studies.addBulkAssignments';


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
 * Read a list of ids from the body.
 *
 * @param {*} raw the list from the body
 * @returns {number[]|null} the unique ids, or null when the value is not a list of integers
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
 *
 * @param {*} raw the list from the body
 * @param {string} keyName "role" or "userId"
 * @returns {Object|null} the map, or null when the shape is wrong, a key repeats, or nothing is left
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
 * Read the workflow mapping: { sourceWorkflowStepId: targetWorkflowStepId | "previousSubmission" }.
 *
 * @param {*} raw the mapping from the body
 * @returns {Object|null} the mapping, or null when the shape is wrong
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
 * Turn the request body into the arguments of createReviewAssignments. Only known keys are read.
 *
 * @param {Object} body request body
 * @returns {Object} {data, bulk}, or {error} with the error key to answer with 400
 */
function readAssignmentBody(body) {
    if (!is.object(body)) {
        return {error: 'errors.rest.assignmentTargetRequired'};
    }
    for (const flag of ['notify', 'dryRun']) {
        if (body[flag] !== undefined && typeof body[flag] !== 'boolean') {
            return {error: 'errors.rest.invalidReviewAssignmentField'};
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
            return {error: 'errors.rest.invalidReviewAssignmentField'};
        }
    }
    data.reviewerIds = reviewerIds;

    if (hasStudy) {
        if (!Number.isInteger(body.studyId)) {
            return {error: 'errors.rest.invalidReviewAssignmentField'};
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
 * because the `assignment` table (assignments that collect submissions) is a different thing.
 *
 * @param {Server} server main server instance
 */
function registerRestReviewAssignmentRoutes(server) {
    server.app.post('/rest/v1/review-assignments', heavyRateLimit(server), (req, res) => {
        const parsed = readAssignmentBody(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        // Same split as the dashboard: one right for a single assignment, another for bulk. Checked
        // before runWrite, so a token without the right never gets a stored Idempotency-Key answer.
        if (!requestHasRight(req, parsed.bulk ? ADD_BULK : ADD_SINGLE)) {
            return res.status(403).json({message: 'errors.rest.missingTokenRight'});
        }
        return runWrite(server, req, res, {
            status: 201,
            label: 'create assignments',
            errors: {notFound: NOT_FOUND, forbidden: FORBIDDEN},
            // A dry run answers 200 with the plan and keeps nothing.
            dryRun: (body) => body.dryRun === true,
        }, (options) => createReviewAssignments({userId: req.apiUserId, ...parsed.data}, options));
    });
}

module.exports = {registerRestReviewAssignmentRoutes};
