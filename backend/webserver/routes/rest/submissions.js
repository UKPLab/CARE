'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');
const {
    listSubmissions,
    getSubmission,
    deleteSubmission,
    uploadSubmission,
} = require('../../sockets/submission');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {removeWrittenFiles} = require('../../sockets/document');
const {runWrite, runRead, readId, uploadFiles} = require('./routeHelpers');

// One submission may need several files (one per file the assignment's validation asks for).
const MAX_SUBMISSION_FILES = 10;

/** A whole number from a multipart field, or undefined when the field is absent. */
function multipartId(raw) {
    if (raw === undefined || raw === '') {
        return undefined;
    }
    return /^\d+$/.test(String(raw)) ? Number(raw) : null;
}

const SUBMISSIONS_VIEW = 'frontend.dashboard.submissions.view';

const SUBMISSION_ERRORS = {
    notFound: new Set(['errors.rest.submissionNotFound']),
    forbidden: new Set(['errors.rest.submissionNoAccess']),
};

/**
 * REST submissions: list, get, upload, and delete. Grouping and grade publishing are not here.
 */
function registerRestSubmissionRoutes(server) {
    const needView = requireTokenRight(server, SUBMISSIONS_VIEW);

    server.app.get('/rest/v1/submissions', needView, (req, res) => runRead(server, req, res, {
        label: 'list submissions',
        errors: SUBMISSION_ERRORS,
    }, async (options) => ({submissions: await listSubmissions({userId: req.apiUserId}, options)})));

    // Multipart: one or more "files", plus assignmentId, and optionally userId (someone else, needs
    // uploadForOthers), validationConfigurationId and projectId (without an assignment), name, description.
    server.app.post('/rest/v1/submissions', needView, heavyRateLimit(server), uploadFiles(MAX_SUBMISSION_FILES), (req, res) => {
        const raw = req.files && req.files.files;
        const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((file) => ({fileName: file.name, content: file.data}));
        const ids = {
            assignmentId: multipartId(req.body?.assignmentId),
            forUserId: multipartId(req.body?.userId),
            validationConfigurationId: multipartId(req.body?.validationConfigurationId),
            projectId: multipartId(req.body?.projectId),
        };
        if (files.length === 0) {
            return res.status(400).json({message: 'errors.rest.filesRequired'});
        }
        if (Object.values(ids).some((value) => value === null)) {
            return res.status(400).json({message: 'errors.rest.invalidSubmissionField'});
        }
        const writtenFiles = [];
        return runWrite(server, req, res, {
            status: 201,
            label: 'upload submission',
            writtenFiles,
            onRollback: () => removeWrittenFiles(writtenFiles, server.logger),
            errors: {
                notFound: new Set(['errors.rest.assignmentNotFound', 'errors.rest.reviewerNotFound']),
                forbidden: new Set(['errors.rest.submissionNoAccess', 'errors.rest.assignmentNoAccess']),
            },
        }, async (options) => ({
            submission: await uploadSubmission({
                userId: req.apiUserId,
                forUserId: ids.forUserId ?? req.apiUserId,
                files,
                assignmentId: ids.assignmentId,
                validationConfigurationId: ids.validationConfigurationId,
                projectId: ids.projectId,
                name: typeof req.body?.name === 'string' ? req.body.name : undefined,
                description: typeof req.body?.description === 'string' ? req.body.description : undefined,
            }, options),
        }));
    });

    server.app.get('/rest/v1/submissions/:id', needView, (req, res) => runRead(server, req, res, {
        label: 'get submission',
        notFound: 'errors.rest.submissionNotFound',
        errors: SUBMISSION_ERRORS,
    }, async (options) => {
        const id = readId(req.params.id);
        const submission = id === null ? null : await getSubmission({userId: req.apiUserId, id}, options);
        return submission ? {submission} : null;
    }));

    server.app.delete('/rest/v1/submissions/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        if (id === null) {
            return res.status(404).json({message: 'errors.rest.submissionNotFound'});
        }
        return runWrite(server, req, res, {
            label: 'delete submission',
            notFound: 'errors.rest.submissionNotFound',
            errors: SUBMISSION_ERRORS,
        }, async (options) => ((await deleteSubmission({userId: req.apiUserId, id}, options)) ? {success: true} : null));
    });
}

module.exports = {registerRestSubmissionRoutes};
