'use strict';

/**
 * Submissions: list, get, upload, delete, for /rest/v1/submissions.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const Validator = require('../../utils/Validator.js');
const {canOf, findActive} = require('../utils/restHelpers');
const {getEmailContent} = require('../../utils/helper/email');

const SUBMISSIONS_SEE_ALL = 'frontend.dashboard.assignments.viewAll';
const SUBMISSIONS_REPLACE_DELETE = 'frontend.dashboard.assignments.replaceDeleteSubmissions';
const SUBMISSION_FIELDS = [
    'id', 'name', 'description', 'userId', 'projectId', 'assignmentId', 'extId',
    'parentSubmissionId', 'previousSubmissionId', 'createdAt',
];

/**
 * Submissions as REST returns them, each with its documents.
 *
 * @param {Object} models the database models
 * @param {Array<Object>} submissions the submission rows
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Array<Object>>} the submissions
 */
async function withDocuments(models, submissions, transaction) {
    const documents = submissions.length === 0 ? [] : await findActive(models['document'],
        {submissionId: submissions.map((submission) => submission.id)},
        {attributes: ['id', 'hash', 'name', 'type', 'submissionId'], order: [['id', 'ASC']], transaction});
    return submissions.map((submission) => ({
        ...Object.fromEntries(SUBMISSION_FIELDS.map((key) => [key, submission[key] ?? null])),
        documents: documents
            .filter((document) => document.submissionId === submission.id)
            .map(({submissionId, ...document}) => document),
    }));
}

/**
 * The caller's submissions, or all of them with the view-all right. Each comes with its documents.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the submissions
 */
async function listSubmissions({userId}, options) {
    const models = options.models;
    const submissions = await canOf(options)(SUBMISSIONS_SEE_ALL)
        ? await models['submission'].getAll()
        : await models['submission'].getAllByKey('userId', userId);
    return withDocuments(models, submissions || []);
}

/**
 * Load a submission: the caller's own, or any with the given right on the token.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the submission id
 * @param {string} [data.right] the right that reaches others' submissions; view-all by default
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the submission, or null when it does not exist
 * @throws {TranslatableError} errors.rest.submissionNoAccess
 */
async function loadSubmission({userId, id, right}, options) {
    const submission = await options.models['submission'].getById(id, {transaction: options.transaction});
    if (!submission) {
        return null;
    }
    if (submission.userId !== userId && !(await canOf(options)(right || SUBMISSIONS_SEE_ALL))) {
        throw new TranslatableError('errors.rest.submissionNoAccess');
    }
    return submission;
}

/**
 * One submission the caller may see, with its documents.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the submission id
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the submission, or null when it does not exist
 * @throws {TranslatableError} errors.rest.submissionNoAccess
 */
async function getSubmission({userId, id}, options) {
    const submission = await loadSubmission({userId, id}, options);
    return submission ? (await withDocuments(options.models, [submission], options.transaction))[0] : null;
}

/**
 * Soft-delete a submission. Same guards as submissionDelete: the assignment must be open and no
 * document of the submission may be used in a study.
 * Mirrors SubmissionSocket.deleteSubmission (submissionDelete). Differs: soft delete only, rights from the token.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the submission id
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 * @throws {TranslatableError} when the assignment is closed or a document is used in a study
 */
async function deleteSubmission({userId, id}, options) {
    const models = options.models;
    const transaction = options.transaction;
    const submission = await loadSubmission({userId, id, right: SUBMISSIONS_REPLACE_DELETE}, options);
    if (!submission) {
        return null;
    }
    const assignment = await models['assignment'].getById(submission.assignmentId, {transaction});
    models['assignment'].assertSubmissionChangesAllowed(assignment, 'errors.submission.deleteAssignmentClosed');
    const documents = await findActive(models['document'], {submissionId: id}, {transaction});
    if (documents.some((document) => Number(document.studyUsageCount || 0) > 0)) {
        throw new TranslatableError('errors.submission.deleteDocumentsUsedInStudies');
    }
    await models['submission'].deleteById(id, {transaction});
    return true;
}

/**
 * Upload a new submission, checked against its validation schema. With an assignment, the upload
 * becomes the next revision of the user's submission, within maxRevisions, and the assignment must
 * be open. Uploading for someone else needs assignments.uploadForOthers on the token.
 * Mirrors DocumentSocket.uploadSingleSubmission (documentUploadSingleSubmission), new-submission path.
 * Differs: checks who the submission is for and that the caller may see the assignment; replacing
 * an existing submission is not offered.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.forUserId who the submission belongs to
 * @param {Array<Object>} data.files the files, each {fileName, content}
 * @param {number} [data.assignmentId] the assignment id
 * @param {number} [data.validationConfigurationId] needed without an assignment
 * @param {number} [data.projectId] the project id
 * @param {string} [data.name] the submission name
 * @param {string} [data.description] the description
 * @param {Object} options the REST options (models, transaction, can, server, logger, writtenFiles)
 * @returns {Promise<Object>} the new submission with its documents
 * @throws {TranslatableError} when access, the assignment, the project, or validation fails
 */
async function uploadSubmission(data, options) {
    const {addDocument} = require('./documentUpload');
    const {canSeeAssignment} = require('./assignments');
    const models = options.models;
    const transaction = options.transaction;
    const {userId, forUserId, files, assignmentId, name, description} = data;
    const can = canOf(options);

    if (forUserId !== userId && !(await can('frontend.dashboard.assignments.uploadForOthers'))) {
        throw new TranslatableError('errors.rest.submissionNoAccess');
    }
    const owner = await models['user'].getById(forUserId, {transaction});
    if (!owner) {
        throw new TranslatableError('errors.rest.reviewerNotFound', {id: forUserId});
    }

    let assignment = null;
    let validationConfigurationId = data.validationConfigurationId ?? null;
    let projectId = data.projectId ?? null;
    // A projectId the caller sent: same rule as documents and assignments, an own or public project.
    // Checked after the assignment, so an unknown assignment is still 404.
    const checkGivenProject = async () => {
        const {userCanUseProject} = require('./projects');
        if (projectId !== null && !(await userCanUseProject(models, userId, projectId))) {
            throw new TranslatableError('errors.rest.invalidProjectId');
        }
    };
    let previousSubmissionId = null;
    if (assignmentId) {
        assignment = await models['assignment'].getById(assignmentId, {transaction});
        if (!assignment) {
            throw new TranslatableError('errors.rest.assignmentNotFound');
        }
        if (!(await canSeeAssignment(models, userId, assignment, can))) {
            throw new TranslatableError('errors.rest.assignmentNoAccess');
        }
        models['assignment'].assertSubmissionChangesAllowed(assignment, 'errors.rest.assignmentClosed');
        await checkGivenProject();
        validationConfigurationId = assignment.validationConfigurationId ?? validationConfigurationId;
        projectId = projectId ?? assignment.projectId ?? null;

        const earlier = await findActive(models['submission'], {assignmentId, userId: forUserId}, {transaction});
        const parents = new Set(earlier.map((row) => row.previousSubmissionId).filter(Boolean));
        const tails = earlier.filter((row) => !parents.has(row.id)).map((row) => row.id);
        previousSubmissionId = tails.length ? Math.max(...tails) : null;
        const limit = assignment.maxRevisions;
        if (previousSubmissionId && limit !== null && limit !== undefined && limit !== -1) {
            const byId = new Map(earlier.map((row) => [row.id, row]));
            let depth = 0;
            for (let id = previousSubmissionId, seen = new Set(); id && byId.has(id) && !seen.has(id); id = byId.get(id).previousSubmissionId) {
                seen.add(id);
                depth += 1;
            }
            if (depth >= limit + 1) {
                throw new TranslatableError('errors.assignment.maxRevisionsReached', {currentCount: depth, maxRevisions: limit});
            }
        }
    } else {
        await checkGivenProject();
        // Resolve the default project first, so the parent lookup uses the project the new
        // submission gets, and a second upload becomes the next version instead of a new chain.
        if (projectId == null) {
            const {defaultProjectFor} = require('./projects');
            projectId = await defaultProjectFor(models, forUserId);
        }
        const parent = await models['submission'].getParentSubmission(forUserId, projectId, true, {transaction});
        previousSubmissionId = parent ? parent.id : null;
    }
    if (!validationConfigurationId) {
        throw new TranslatableError('errors.rest.validationConfigurationRequired');
    }
    // A submission always belongs to a project: the given one, the assignment's, or the owner's default.
    if (projectId == null) {
        const {defaultProjectFor} = require('./projects');
        projectId = await defaultProjectFor(models, forUserId);
    }
    if (projectId == null) {
        throw new TranslatableError('errors.rest.submissionProjectRequired');
    }

    const validation = await new Validator(options.server, models).validateSubmissionFiles(files, validationConfigurationId);
    if (!validation.success) {
        throw new TranslatableError(validation.message || 'errors.validation.validationFailedGeneric', validation.params);
    }

    const submission = await models['submission'].add({
        userId: forUserId,
        createdByUserId: userId,
        validationConfigurationId,
        previousSubmissionId,
        projectId,
        assignmentId: assignmentId || null,
        name: name ?? null,
        description: description ?? null,
    }, {transaction});
    for (const file of files) {
        await addDocument({
            actingUserId: userId,
            userId: forUserId,
            file: file.content,
            name: file.fileName,
            isUploaded: true,
            submissionId: submission.id,
            projectId,
        }, options);
    }

    if (assignment) {
        transaction.afterCommit(() => {
            sendSubmissionUploadEmail(models, options.server, options.logger, assignment, submission, forUserId)
                .catch((err) => options.logger.error('Failed to send submission upload email: ' + err));
            Promise.resolve(options.server.triggers?.addEvent('submission.uploaded', {
                assignmentId: assignment.id,
                submissionId: submission.id,
                userId: forUserId,
                projectId,
                timestamp: submission.createdAt,
            })).catch((err) => options.logger.error('Failed to queue submission upload triggers: ' + err));
        });
    }
    return getSubmission({userId, id: submission.id}, {...options, can: async () => true});
}

/**
 * Mirrors DocumentSocket.sendSubmissionUploadEmail for a first upload: the assignment owner gets
 * a notice (unless notifyOnSubmissionUpload is off), and the submitter a confirmation.
 *
 * @param {Object} models the database models
 * @param {Server} server main server instance
 * @param {Object} logger the server logger
 * @param {Object} assignment the assignment row
 * @param {Object} submission the new submission
 * @param {number} submitterUserId who the submission belongs to
 * @returns {Promise<void>}
 */
async function sendSubmissionUploadEmail(models, server, logger, assignment, submission, submitterUserId) {
    if (assignment.notifyOnSubmissionUpload === false) {
        return;
    }
    const context = {
        assignmentName: assignment.name,
        assignmentId: assignment.id,
        submissionId: submission.id,
        eventType: 'uploaded',
        eventLabel: 'Uploaded',
        eventLabelLower: 'uploaded',
        timestamp: submission.createdAt ? new Date(submission.createdAt).toLocaleString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }) : '',
    };
    const send = async (recipientId, settingKey, fallbackKey) => {
        const user = await models['user'].getById(recipientId);
        if (!user || !user.email) {
            logger.warn(`Cannot send ${fallbackKey} email: user ${recipientId} has no email`);
            return;
        }
        const content = await getEmailContent(settingKey, fallbackKey, {userId: recipientId, ...context}, models, logger);
        await server.sendMail(user.email, content.subject, content.body, {isHtml: content.isHtml});
    };
    await send(assignment.userId, 'email.template.submissionUpload', 'submissionUpload');
    if (submitterUserId && submitterUserId !== assignment.userId) {
        await send(submitterUserId, 'email.template.submissionUploadConfirmation', 'submissionUploadConfirmation');
    }
}

module.exports = {
    deleteSubmission,
    getSubmission,
    listSubmissions,
    uploadSubmission,
};
