'use strict';

/**
 * Review assignments, part 2: create one review study per item, with its step documents.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");

/**
 * Add the item's id to every template marker in a study step configuration.
 *
 * @param {*} config the step configuration, or a part of it
 * @param {Object} context {assignmentType, submissionId, documentId}
 * @returns {*} the configuration with the markers filled
 */
function fillTemplateMarkers(config, context) {
    if (Array.isArray(config)) {
        return config.map((entry) => fillTemplateMarkers(entry, context));
    }
    if (!config || typeof config !== 'object') {
        return config;
    }
    const result = {};
    for (const [key, value] of Object.entries(config)) {
        if (!value || !value.isTemplate) {
            result[key] = fillTemplateMarkers(value, context);
        } else if (context.assignmentType === 'submission') {
            result[key] = {...value, submissionId: context.submissionId};
        } else if (context.assignmentType === 'document') {
            result[key] = {...value, documentId: context.documentId};
        } else {
            result[key] = {
                ...value,
                ...(context.submissionId && {submissionId: context.submissionId}),
                ...(context.documentId && {documentId: context.documentId}),
            };
        }
    }
    return result;
}

/**
 * The PDF a submission is reviewed on: the one named in its validation configuration, else the first.
 *
 * @param {Object} models the database models
 * @param {Object} submission the submission row
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<number|null>} the document id, or null when the submission has no PDF
 */
async function primaryDocumentId(models, submission, transaction) {
    const docs = await models['document'].findAll({
        where: {submissionId: submission.id, deleted: false, type: 0},
        order: [['id', 'ASC']],
        raw: true,
        transaction,
    });
    if (docs.length === 0) {
        return null;
    }
    const configuration = submission.validationConfigurationId
        ? await models['configuration'].getById(submission.validationConfigurationId, {transaction})
        : null;
    const primaryId = configuration?.content?.primaryDocument ?? configuration?.primaryDocument;
    return (docs.find((doc) => doc.id === primaryId) || docs[0]).id;
}

/**
 * Copy a study session's documents for a follow-up study, one entry per mapped workflow step.
 * Mirrors AssignmentSocket.duplicate, for one session.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Object} studySession the study session row
 * @param {Object} workflowMapping new workflow step id to the source workflow step id, or 'previousSubmission'
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Array<Object>>} one {documentId, workflowStepId, submissionId} per step
 * @throws {TranslatableError} when a mapped step or submission is missing
 */
async function duplicateSessionDocuments(models, userId, studySession, workflowMapping, transaction) {
    const documents = [];
    let previousSubmissionId = null;
    for (const [sourceWorkflowStepId, targetWorkflowStepId] of Object.entries(workflowMapping)) {
        if (targetWorkflowStepId === 'previousSubmission') {
            if (previousSubmissionId === null) {
                throw new TranslatableError('errors.assignment.firstStepNotSubmission');
            }
            const original = await models['submission'].findOne({where: {id: previousSubmissionId}, transaction});
            const root = await models['submission'].getRootSubmission(original);
            const latest = await models['submission'].findOne({where: {previousSubmissionId: root?.id}, transaction});
            if (!latest) {
                throw new TranslatableError('errors.assignment.latestSubmissionNotFound');
            }
            const document = await models['document'].findOne({where: {submissionId: latest.id, type: 0}, transaction});
            if (!document) {
                throw new TranslatableError('errors.assignment.latestSubmissionNotFound');
            }
            documents.push({
                documentId: document.id,
                workflowStepId: Number(sourceWorkflowStepId),
                submissionId: document.submissionId || null,
            });
            continue;
        }

        const sourceStep = await models['study_step'].findOne({
            where: {workflowStepId: targetWorkflowStepId, studyId: studySession.studyId},
            transaction,
        });
        const original = sourceStep && await models['document'].getById(sourceStep.documentId, {transaction});
        if (!original) {
            throw new TranslatableError('errors.rest.invalidWorkflowMapping');
        }
        previousSubmissionId = original.submissionId;
        const scope = [
            {studySessionId: null, studyStepId: null},
            {studySessionId: studySession.id, studyStepId: sourceStep.id},
        ];
        let copy;
        if (original.submissionId) {
            const result = await models['submission'].copySubmission(
                original.submissionId, userId, {hideInFrontend: true}, {}, scope, {transaction});
            copy = result.copiedDocuments.find((doc) => doc.parentDocumentId === original.id);
        } else {
            copy = await models['document'].duplicateDocument(original.id, {}, scope, {transaction});
        }
        documents.push({
            documentId: copy.id,
            workflowStepId: Number(sourceWorkflowStepId),
            submissionId: copy.submissionId || null,
        });
    }
    return documents;
}

/**
 * The document for each workflow step of one item. Documents and submissions go on the first step.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {string} type the item type
 * @param {Object} item the document, submission, or study session row
 * @param {Array<Object>} workflowSteps the workflow steps of the template
 * @param {Object} [workflowMapping] the step mapping, for study sessions
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Array<Object>>} one {documentId, workflowStepId} per step
 */
async function itemStepDocuments(models, userId, type, item, workflowSteps, workflowMapping, transaction) {
    if (type === 'study_session') {
        return duplicateSessionDocuments(models, userId, item, workflowMapping, transaction);
    }
    const firstDocumentId = type === 'submission'
        ? await primaryDocumentId(models, item, transaction)
        : item.id;
    return workflowSteps.map((step, index) => ({
        documentId: index === 0 ? firstDocumentId : null,
        workflowStepId: step.id,
    }));
}

/**
 * Create one review study for one item from the template. Same result as AssignmentSocket.createAssignment.
 * Mirrors AssignmentSocket.createAssignment. Differs: template loaded by id instead of sent by the client.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} data.template the template row
 * @param {Array<Object>} data.templateSteps the template's study steps
 * @param {Array<Object>} data.workflowSteps the template's workflow steps
 * @param {string} data.type the item type
 * @param {Object} data.item the item to review
 * @param {Array<Object>} data.documents the step documents from itemStepDocuments
 * @param {number} data.reviewerCount how many sessions the study allows
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new study
 */
async function createAssignmentStudy({userId, template, templateSteps, workflowSteps, type, item, documents, reviewerCount}, options) {
    const models = options.models;
    const workflowStepById = Object.fromEntries(workflowSteps.map((step) => [step.id, step]));
    const stepDocuments = [];
    for (const step of templateSteps) {
        if (!step.workflowStepId) {
            continue;
        }
        const override = documents.find((doc) => doc.workflowStepId === step.workflowStepId) || null;
        let documentId = override?.documentId ?? step.documentId;
        if (override?.documentId == null) {
            // A step that shows another step's document inherits that step's template document.
            const reference = workflowStepById[step.workflowStepId]?.workflowStepDocument;
            const referenced = reference != null && templateSteps.find((other) => other.workflowStepId === reference);
            if (referenced && referenced.documentId != null) {
                documentId = referenced.documentId;
            }
        }
        const context = {assignmentType: type, submissionId: null, documentId: null};
        if (type === 'study_session') {
            context.submissionId = override?.submissionId || null;
            context.documentId = documentId || null;
        } else if (type === 'submission') {
            context.submissionId = item.id;
        } else {
            context.documentId = item.id;
        }
        stepDocuments.push({
            id: step.workflowStepId,
            documentId,
            configuration: fillTemplateMarkers(step.configuration, context),
        });
    }

    const newStudy = {
        ...template,
        createdByUserId: userId,
        userId: item.userId,
        template: false,
        id: undefined,
        hash: undefined,
        closed: undefined,
        userIdClosed: undefined,
        parentStudyId: type === 'study_session' ? item.studyId : null,
        limitSessions: reviewerCount,
        limitSessionsPerUser: 1,
        resumable: true,
        stepDocuments,
    };
    return models['study'].add(newStudy, {
        transaction: options.transaction,
        context: newStudy,
        doNotDuplicate: type === 'study_session',
    });
}

module.exports = {
    createAssignmentStudy,
    itemStepDocuments,
};
