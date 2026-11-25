'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {listAssignments, getAssignment, addAssignment, updateAssignment, closeAssignment, deleteAssignment} = require('../../rest/assignments');

const ASSIGNMENTS_VIEW = 'frontend.dashboard.assignments.view';
const ERRORS = {
    notFound: new Set(['errors.rest.assignmentNotFound', 'errors.rest.roleNotFound', 'errors.rest.reviewerNotFound']),
    forbidden: new Set(['errors.rest.assignmentNoAccess']),
};
const FIELDS = {
    name: is.text,
    description: is.textOrNull,
    projectId: is.idOrNull,
    start: is.dateOrNull,
    end: is.dateOrNull,
    maxRevisions: (value) => Number.isInteger(value) && value >= -1,
    validationConfigurationId: is.idOrNull,
    allowReUpload: is.bool,
    notifyOnSubmissionUpload: is.bool,
    submissionWarning: is.textOrNull,
};

/**
 * Read the share list of an assignment: {"roles": [id or name], "users": [id]}, both optional.
 *
 * @param {*} raw the shareWith value from the body
 * @returns {Object} {shareWith}, or {error: true} when the shape is wrong
 */
function readShareWith(raw) {
    if (raw === undefined) {
        return {shareWith: undefined};
    }
    if (!is.object(raw)) {
        return {error: true};
    }
    const roles = raw.roles ?? [];
    const users = raw.users ?? [];
    const roleOk = (value) => Number.isInteger(value) || (typeof value === 'string' && value !== '');
    if (!Array.isArray(roles) || !Array.isArray(users) || !roles.every(roleOk) || !users.every(is.id)) {
        return {error: true};
    }
    return {shareWith: {roles, users}};
}

/**
 * REST assignments: the `assignment` table, which collects submissions (not review assignments,
 * which are under /review-assignments).
 *
 * @param {Server} server main server instance
 */
function registerRestAssignmentRoutes(server) {
    const needView = requireTokenRight(server, ASSIGNMENTS_VIEW);
    const spec = (label, extra = {}) => ({label, notFound: 'errors.rest.assignmentNotFound', errors: ERRORS, ...extra});

    server.app.get('/rest/v1/assignments', needView, (req, res) => runRead(server, req, res, spec('list assignments'),
        async (options) => ({assignments: await listAssignments({userId: req.apiUserId}, options)})));

    server.app.get('/rest/v1/assignments/:id', needView, (req, res) => runRead(server, req, res, spec('get assignment'),
        async (options) => {
            const id = readId(req.params.id);
            const assignment = id && await getAssignment({userId: req.apiUserId, id}, options);
            return assignment ? {assignment} : null;
        }));

    server.app.post('/rest/v1/assignments', needView, (req, res) => {
        const parsed = readFields(req.body, FIELDS);
        const share = readShareWith(req.body?.shareWith);
        if (parsed.error || share.error || !parsed.fields.name) {
            return res.status(400).json({message: 'errors.rest.invalidAssignmentField'});
        }
        return runWrite(server, req, res, spec('create assignment', {status: 201}), async (options) =>
            ({assignment: await addAssignment({userId: req.apiUserId, fields: parsed.fields, shareWith: share.shareWith}, options)}));
    });

    server.app.patch('/rest/v1/assignments/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, FIELDS);
        const share = readShareWith(req.body?.shareWith);
        if (parsed.error || share.error || (Object.keys(parsed.fields).length === 0 && !share.shareWith)) {
            return res.status(400).json({message: 'errors.rest.invalidAssignmentField'});
        }
        return runWrite(server, req, res, spec('update assignment'), async (options) => {
            const assignment = id && await updateAssignment(
                {userId: req.apiUserId, id, fields: parsed.fields, shareWith: share.shareWith}, options);
            return assignment ? {assignment} : null;
        });
    });

    server.app.post('/rest/v1/assignments/:id/close', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('close assignment'), async (options) => {
            const assignment = id && await closeAssignment({userId: req.apiUserId, id}, options);
            return assignment ? {assignment} : null;
        });
    });

    server.app.delete('/rest/v1/assignments/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete assignment'), async (options) =>
            (id && await deleteAssignment({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });
}

module.exports = {registerRestAssignmentRoutes};
