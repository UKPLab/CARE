const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {canOf} = require('../utils/restHelpers');
const Validator = require('../../utils/Validator.js');
const {getEmailContent} = require('../../utils/helper/email');


/**
 * Submission actions for /rest/v1 only. The socket methods below do not call these.
 * A caller reaches their own submissions. Other users' submissions need a named right on the token.
 */

const SUBMISSIONS_SEE_ALL = 'frontend.dashboard.assignments.viewAll';
const SUBMISSIONS_REPLACE_DELETE = 'frontend.dashboard.assignments.replaceDeleteSubmissions';
const SUBMISSION_FIELDS = [
    'id', 'name', 'description', 'userId', 'projectId', 'assignmentId', 'extId',
    'parentSubmissionId', 'previousSubmissionId', 'createdAt',
];

async function withDocuments(models, submissions, transaction) {
    const documents = submissions.length === 0 ? [] : await models['document'].findAll({
        where: {submissionId: submissions.map((submission) => submission.id), deleted: false},
        attributes: ['id', 'hash', 'name', 'type', 'submissionId'],
        order: [['id', 'ASC']],
        raw: true,
        transaction,
    });
    return submissions.map((submission) => ({
        ...Object.fromEntries(SUBMISSION_FIELDS.map((key) => [key, submission[key] ?? null])),
        documents: documents
            .filter((document) => document.submissionId === submission.id)
            .map(({submissionId, ...document}) => document),
    }));
}

/**
 * The caller's submissions, or all of them with the view-all right. Each comes with its documents.
 */
async function listSubmissions({userId}, options) {
    const models = options.models;
    const submissions = await canOf(options)(SUBMISSIONS_SEE_ALL)
        ? await models['submission'].getAll()
        : await models['submission'].getAllByKey('userId', userId);
    return withDocuments(models, submissions || []);
}

/**
 * @returns {Promise<Object|null>} null when the submission does not exist
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

async function getSubmission({userId, id}, options) {
    const submission = await loadSubmission({userId, id}, options);
    return submission ? (await withDocuments(options.models, [submission], options.transaction))[0] : null;
}

/**
 * Soft-delete a submission. Same guards as submissionDelete: the assignment must be open and no
 * document of the submission may be used in a study.
 * Mirrors SubmissionSocket.deleteSubmission (submissionDelete). Differs: soft delete only, rights from the token.
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
    const documents = await models['document'].findAll({
        where: {submissionId: id, deleted: false},
        raw: true,
        transaction,
    });
    if (documents.some((document) => Number(document.studyUsageCount || 0) > 0)) {
        throw new TranslatableError('errors.submission.deleteDocumentsUsedInStudies');
    }
    await models['submission'].deleteById(id, {transaction});
    return true;
}

/**
 * Handle submissions through websocket
 *
 * @author Linyin Huang
 * @type {SubmissionSocket}
 * @class SubmissionSocket
 */
class SubmissionSocket extends Socket {
    /**
     * Assign group to submissions and optionally copy them
     *
     * @param {Object} data - The data object containing submission parameters
     * @param {number} data.group - The group number to be assigned to the submissions
     * @param {boolean} data.isCopied - Indicates whether the submissions should be copied
     * @param {Array<number>} data.submissionIds - Array containing the IDs of the submissions
     * @param {Object} data.additionalSettings - Additional settings for the submissions
     * @param {Object} options - Database options including transaction
     * @returns {Promise<Object>} A promise that resolves with operation results
     * @throws {Error} If the operation fails
     */
    async assignGroupToSubmissions(data, options = {}) {
        const {group, isCopied, submissionIds, additionalSettings} = data;
        const transaction = options.transaction;
        if (isCopied) {
            // Copy submissions after group assignment (copies will inherit the group)
            const copiedResults = [];
            for (const submissionId of submissionIds) {
                try {
                    const copyResult = await this.models["submission"].copySubmission(submissionId, this.userId, {transaction});
                    copiedResults.push(copyResult);
                } catch (error) {
                    if (TranslatableError.is(error)) {
                        throw error;
                    }
                    throw new TranslatableError( "errors.submission.copyWithIdFailed", {submissionId, message: error.message});
                }
            }
            const copiedSubmissionIds = copiedResults.map(({copiedSubmission}) => copiedSubmission.id);
            await this.models["submission"].assignGroup(copiedSubmissionIds, group, additionalSettings, {transaction});
            return {
                success: true,
                copiedSubmissions: copiedResults,
            };
        } else {
            await this.models["submission"].assignGroup(submissionIds, group, additionalSettings, {transaction});
            return {
                success: true,
                submissionsUpdated: submissionIds.length,
            };
        }
    }

    /**
     * Update a submission document
     *
     * @param {Object} data - The data object containing submission parameters
     * @param {number} data.id - The ID of the submission to be updated
     * @param {Object} options - Database options including transaction
     * @returns {Promise<void>} A promise that resolves when the update is complete
     * @throws {Error} If the user is not allowed to update the document
     */
    async deleteSubmission(data, options) {
        const { id, force = false } = data;
        const transaction = options.transaction;

        const submission = await this.models['submission'].getById(id, { transaction });
        if (!submission) {
            throw new TranslatableError("errors.submission.notFoundGeneric");
        }
        if (!(await this.checkUserAccess(submission.userId))) {
            throw new TranslatableError("errors.submission.updateNotAllowed");
        }

        const assignment = await this.models['assignment'].getById(submission.assignmentId, { transaction });
        this.models['assignment'].assertSubmissionChangesAllowed(
            assignment,
            "errors.submission.deleteAssignmentClosed"
        );

        const documents = await this.models['document'].findAll({
            where: { submissionId: id, deleted: false },
            raw: true,
            transaction,
        });
        const isStudyLocked = documents.some(doc => Number(doc.studyUsageCount || 0) > 0);
        if (isStudyLocked) {
            throw new TranslatableError("errors.submission.deleteDocumentsUsedInStudies");
        }

        return await this.models['submission'].deleteById(id, { force, transaction });
    }

    /**
     * Publishes grades for an assignment to Moodle.
     *
     * @param {Object} data - The data required for uploading assignment grade.
     * @param {Object} data.options - The options object containing the API key and URL of the Moodle instance.
     * @param {Array<Object>} data.grades - An array of objects containing the grade data.
     * @returns {Promise<Object>} - A promise that resolves when the grades have been uploaded.
     * @throws {Error} If the user does not have admin permission.
     * @see MoodleRPC#publishAssignmentGrade
     */
    async publishGrades(data) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.submission.noGradeUploadPermission");
        }
        return await this.server.rpcs["MoodleRPC"].publishAssignmentGrade({
            options: data.options,
            grades: data.grades,
        });
    }

    init() {
        this.createSocket("submissionAssignGroup", this.assignGroupToSubmissions, {}, true);
        this.createSocket("submissionDelete", this.deleteSubmission, {}, true);
        this.createSocket("submissionPublishGrades", this.publishGrades, {}, false);
    }
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
 * @param {number} data.userId acting user, from the token
 * @param {number} data.forUserId who the submission belongs to
 * @param {Array<{fileName: string, content: Buffer}>} data.files
 * @param {number} [data.assignmentId]
 * @param {number} [data.validationConfigurationId] needed without an assignment
 * @param {Object} options transaction, models, server, logger, can, writtenFiles
 */
async function uploadSubmission(data, options) {
    const {addDocument} = require('./document');
    const {canSeeAssignment} = require('./assignment');
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
        const {userCanUseProject} = require('./project');
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

        const earlier = await models['submission'].findAll({
            where: {assignmentId, userId: forUserId, deleted: false},
            raw: true,
            transaction,
        });
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
        const parent = await models['submission'].getParentSubmission(forUserId, projectId, true, {transaction});
        previousSubmissionId = parent ? parent.id : null;
    }
    if (!validationConfigurationId) {
        throw new TranslatableError('errors.rest.validationConfigurationRequired');
    }
    // A submission always belongs to a project: the given one, the assignment's, or the owner's default.
    if (projectId == null) {
        const {defaultProjectFor} = require('./project');
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

module.exports = SubmissionSocket;
module.exports.listSubmissions = listSubmissions;
module.exports.getSubmission = getSubmission;
module.exports.deleteSubmission = deleteSubmission;
module.exports.uploadSubmission = uploadSubmission;
