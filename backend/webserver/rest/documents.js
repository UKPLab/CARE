'use strict';

/**
 * Documents: access, list, get, text, create, update, for /rest/v1/documents.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const fs = require("fs");
const path = require("path");
const Delta = require('quill-delta');
const TranslatableError = require("../../utils/TranslatableError");
const UPLOAD_PATH = `${__dirname}/../../../files`;
const {applyTemplateToDocument} = require('../../utils/helper/documentTemplate.js');
const {canOf, findActive, loadByIdOrHash, pickFields} = require('../utils/restHelpers');
const {dbToDelta} = require('editor-delta-conversion');
const {docTypes} = require('../../db/models/document.js');
const {userCanUseProject} = require('./projects');

// What REST returns for a document. A new column stays out of REST until it is added here.
const DOCUMENT_PUBLIC_FIELDS = [
    'id', 'hash', 'name', 'type', 'userId', 'projectId', 'public', 'submissionId', 'originalFilename',
    'createdAt', 'updatedAt',
];

/**
 * The document fields REST returns.
 *
 * @param {Object} document the document row
 * @returns {Object} the public fields
 */
function publicDocument(document) {
    return pickFields(document, DOCUMENT_PUBLIC_FIELDS);
}

const DOCUMENTS_SEE_ALL = 'frontend.dashboard.assignments.viewAll';
const STUDIES_FULL_ACCESS = 'frontend.dashboard.studies.fullAccess';

/**
 * Over REST only the owner changes, deletes, or replaces a document. No right reaches another
 * user's document for writing; that stays a dashboard action.
 *
 * @param {number} userId the token owner's user id
 * @param {Object} document the document row
 * @returns {boolean}
 */
function ownsDocument(userId, document) {
    return document.userId === userId;
}

/**
 * Whether the caller may read a document: public, own, viewAll on the token, or used in a study they
 * own or have a session in.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} documentId the document id
 * @param {Function} [can] checks a right of the token
 * @param {Object|null} [loaded] the document row, when the caller already loaded it
 * @returns {Promise<boolean>}
 */
async function userHasDocumentAccess(models, userId, documentId, can = async () => false, loaded = null) {
    // A caller that already loaded the document passes it, so it is not read twice.
    const doc = loaded ?? await models['document'].getById(documentId);

    if (doc && (doc.public || doc.userId === userId || await can(DOCUMENTS_SEE_ALL))) {
        return true;
    }

    const study_steps = await models['study_step'].getAllByKey('documentId', documentId);
    const study_ids = study_steps.map(step => step.studyId);
    const study_sessions = await models['study_session'].getAllByKey('studyId', study_ids);
    const studies = await models['study'].getAllByKey('id', study_ids);

    for (const study of studies) {
        if (study.userId === userId) {
            return true;
        }
    }

    for (const session of study_sessions) {
        if (session.userId === userId || await can(STUDIES_FULL_ACCESS)) {
            return true;
        }
    }

    return false;
}

/**
 * Load a document by id or hash.
 *
 * @param {Object} models the database models
 * @param {number|string} idOrHash the document id or hash
 * @returns {Promise<Object|null>} the document, or null when it does not exist
 */
async function loadDocumentByIdOrHash(models, idOrHash) {
    return loadByIdOrHash(models['document'], idOrHash);
}

/**
 * Mirrors DocumentSocket list via the document table subscription. Differs: viewAll comes from the token, not admin.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the documents
 */
async function listDocuments({userId}, options) {
    const models = options.models;
    if (await canOf(options)(DOCUMENTS_SEE_ALL)) {
        return models['document'].getAll();
    }
    return models['document'].getAllByKey('userId', userId);
}

/**
 * Current text of an HTML or modal document: the saved .delta file plus the base edits not yet
 * written to it. A missing .delta file counts as empty.
 * Mirrors DocumentSocket.getDocument for the base document (no study session). Differs: returns
 * plain text too, and reads no session copies.
 *
 * @param {Object} data
 * @param {Object} data.document the document row
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object>} {delta, text}
 */
async function readDocumentContent({document}, options) {
    let delta = new Delta();
    const deltaPath = path.join(UPLOAD_PATH, `${document.hash}.delta`);
    if (fs.existsSync(deltaPath)) {
        delta = new Delta(JSON.parse(fs.readFileSync(deltaPath, 'utf8')));
    }
    const edits = await findActive(options.models['document_edit'],
        {documentId: document.id, studySessionId: null, studyStepId: null, draft: true}, {raw: false});
    delta = delta.compose(dbToDelta(edits));
    const text = delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');
    return {delta: {ops: delta.ops}, text};
}

/**
 * Own or public templates only.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} templateId the template id
 * @returns {Promise<boolean>}
 */
async function userCanUseTemplate(models, userId, templateId) {
    const template = await models['template'].getById(templateId);
    if (!template || template.deleted) {
        return false;
    }
    return template.public === true || template.userId === userId;
}

/**
 * Mirrors DocumentSocket.createDocument (documentCreate). Differs: project and template must be own or public.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {string} data.name the document name
 * @param {number} data.type the document type
 * @param {number} [data.templateId] the template to fill the document from
 * @param {number} [data.projectId] the project id
 * @param {Object} options the REST options (models, transaction, logger)
 * @returns {Promise<Object>} the new document
 * @throws {TranslatableError} errors.rest.invalidProjectId or errors.rest.invalidTemplateId
 */
async function createDocument({userId, name, type, templateId, projectId}, options) {
    const models = options.models;
    if (projectId !== undefined && projectId !== null && !(await userCanUseProject(models, userId, projectId))) {
        throw new TranslatableError('errors.rest.invalidProjectId');
    }
    if (templateId && !(await userCanUseTemplate(models, userId, templateId))) {
        throw new TranslatableError('errors.rest.invalidTemplateId');
    }
    const doc = await models["document"].add({
        name,
        type,
        userId,
        projectId,
    }, {transaction: options.transaction});

    if (templateId && (doc.type === docTypes.DOC_TYPE_HTML || doc.type === docTypes.DOC_TYPE_MODAL)) {
        await applyTemplateToDocument(
            doc,
            templateId,
            models,
            {transaction: options.transaction, logger: options.logger}
        );
    }
    return doc;
}

/**
 * Mirrors DocumentSocket.updateDocument (documentUpdate). Differs: only name and public, own documents only.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.documentId the document id
 * @param {Object} data.fields the fields to change
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the updated document, or null when it does not exist
 * @throws {TranslatableError} errors.documents.updateNotAllowed
 */
async function updateDocumentFields({userId, documentId, fields}, options) {
    const models = options.models;
    const doc = await models['document'].getById(documentId);
    if (!doc) {
        return null;
    }
    if (!ownsDocument(userId, doc)) {
        throw new TranslatableError("errors.documents.updateNotAllowed");
    }
    const allowed = {};
    if (Object.prototype.hasOwnProperty.call(fields, 'name')) {
        allowed.name = fields.name;
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'public')) {
        allowed.public = fields.public;
    }
    return models['document'].updateById(doc.id, allowed, {transaction: options.transaction});
}

module.exports = {
    createDocument,
    listDocuments,
    loadDocumentByIdOrHash,
    ownsDocument,
    publicDocument,
    readDocumentContent,
    updateDocumentFields,
    userHasDocumentAccess,
};
