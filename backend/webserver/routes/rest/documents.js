'use strict';

const fs = require('fs');
const TranslatableError = require('../../../utils/TranslatableError');
const {requireTokenRight, tokenCan} = require('../../middleware/bearerAuth');
const {sendKnownError} = require('../../utils/restHelpers');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead, uploadFiles} = require('./routeHelpers');
const {docTypes} = require('../../../db/models/document.js');
const {replaceDocumentFile, storedFilePath} = require('../../rest/documentReplace');
const {addDocument, removeWrittenFiles} = require('../../rest/documentUpload');
const {createDocument, listDocuments, updateDocumentFields, userHasDocumentAccess, ownsDocument, publicDocument, readDocumentContent, loadDocumentByIdOrHash} = require('../../rest/documents');
const {listDocumentAnnotations, listDocumentComments} = require('../../rest/notes');
const {userCanUseProject} = require('../../rest/projects');

const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';
const DOCUMENTS_UPLOAD = 'frontend.dashboard.documents.upload';

// Socket error keys mapped to the REST keys the docs promise.
const DOCUMENT_ERRORS = {
    rename: {
        'errors.documents.updateNotAllowed': 'errors.rest.documentNoAccess',
        'errors.documents.noAccess': 'errors.rest.documentNoAccess',
        'errors.documents.replaceFileNoPermission': 'errors.rest.documentNoAccess',
        'errors.documents.noUploadAccess': 'errors.rest.documentNoAccess',
        'errors.documents.doesNotExistOrDeleted': 'errors.rest.documentNotFound',
    },
    notFound: new Set(['errors.rest.documentNotFound']),
    forbidden: new Set(['errors.rest.documentNoAccess']),
};

/**
 * The document behind :idOrHash if the caller may see it.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number|string} idOrHash the document id or hash from the path
 * @param {Function} can checks a right of the token
 * @returns {Promise<Object>} the document
 * @throws {TranslatableError} errors.rest.documentNotFound (404) or errors.rest.documentNoAccess (403)
 */
async function accessibleDocument(models, userId, idOrHash, can) {
    const document = await loadDocumentByIdOrHash(models, idOrHash);
    if (!document) {
        throw new TranslatableError('errors.rest.documentNotFound');
    }
    if (!(await userHasDocumentAccess(models, userId, document.id, can))) {
        throw new TranslatableError('errors.rest.documentNoAccess');
    }
    return document;
}

/**
 * The uploaded file in the "file" field; the first one when several were sent.
 *
 * @param {Object} req express request, after the upload middleware
 * @returns {Object|null} the file, or null when none was sent
 */
function uploadedFile(req) {
    const raw = req.files && req.files.file;
    if (!raw) {
        return null;
    }
    return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Whether a multipart field was sent with a value. An absent or empty field counts as not sent.
 *
 * @param {*} value the field value
 * @returns {boolean}
 */
function present(value) {
    return value !== undefined && value !== '';
}

/**
 * REST documents: collection, item, /upload for a new file, /file to download or replace one.
 *
 * @param {Server} server main server instance
 */
function registerRestDocumentRoutes(server) {
    const models = server.db.models;
    const needDocuments = requireTokenRight(server, DOCUMENTS_VIEW);
    const needUpload = requireTokenRight(server, DOCUMENTS_UPLOAD);
    const read = (req, res, label, work) => runRead(server, req, res, {label, errors: DOCUMENT_ERRORS}, work);

    server.app.get('/rest/v1/documents', needDocuments, (req, res) => read(req, res, 'list documents', async (options) => {
        const documents = await listDocuments({userId: req.apiUserId}, options);
        return {documents: (documents || []).map(publicDocument)};
    }));

    server.app.post('/rest/v1/documents/upload', needDocuments, needUpload, heavyRateLimit(server), uploadFiles(1), (req, res) => {
        // Files written before a failure are removed again after rollback.
        const writtenFiles = [];
        return runWrite(server, req, res, {
            status: 201,
            label: 'upload document',
            errors: DOCUMENT_ERRORS,
            writtenFiles,
            onRollback: () => removeWrittenFiles(writtenFiles, server.logger),
        }, async (options) => {
            const uploaded = uploadedFile(req);
            if (!uploaded) {
                throw new TranslatableError('errors.rest.fileRequired');
            }
            // Importing PDF annotations needs the text the dashboard extracts in the browser, which a
            // script does not send, so it is refused instead of silently importing nothing.
            const importAnnotations = req.body?.importAnnotations;
            if (present(importAnnotations) && importAnnotations !== 'false' && importAnnotations !== false) {
                throw new TranslatableError('errors.rest.importAnnotationsNotSupported');
            }
            // type only chooses HTML or modal for a .delta upload. Anything else is rejected.
            let type;
            if (present(req.body?.type)) {
                type = Number(req.body.type);
                if (type !== docTypes.DOC_TYPE_HTML && type !== docTypes.DOC_TYPE_MODAL) {
                    throw new TranslatableError('errors.rest.unsupportedDocumentType');
                }
            }
            let projectId;
            if (present(req.body?.projectId)) {
                projectId = Number(req.body.projectId);
                if (!Number.isInteger(projectId) || !(await userCanUseProject(models, req.apiUserId, projectId))) {
                    throw new TranslatableError('errors.rest.invalidProjectId');
                }
            }
            const result = await addDocument({
                actingUserId: req.apiUserId,
                file: uploaded.data,
                name: uploaded.name,
                type,
                projectId,
            }, options);
            return {
                document: publicDocument(result.doc),
                errors: result.errors,
            };
        });
    });

    server.app.post('/rest/v1/documents', needDocuments, (req, res) => runWrite(server, req, res, {
        status: 201,
        label: 'create document',
        errors: DOCUMENT_ERRORS,
    }, async (options) => {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        if (!name) {
            throw new TranslatableError('errors.rest.documentNameRequired');
        }
        const type = req.body?.type === undefined ? docTypes.DOC_TYPE_HTML : Number(req.body.type);
        if (type !== docTypes.DOC_TYPE_HTML && type !== docTypes.DOC_TYPE_MODAL) {
            throw new TranslatableError('errors.rest.unsupportedDocumentType');
        }
        let projectId;
        if (req.body?.projectId !== undefined && req.body.projectId !== null) {
            projectId = Number(req.body.projectId);
            if (!Number.isInteger(projectId)) {
                throw new TranslatableError('errors.rest.invalidProjectId');
            }
        }
        let templateId;
        if (req.body?.templateId) {
            templateId = Number(req.body.templateId);
            if (!Number.isInteger(templateId)) {
                throw new TranslatableError('errors.rest.invalidTemplateId');
            }
        }
        const document = await createDocument({userId: req.apiUserId, name, type, templateId, projectId}, options);
        return {document: publicDocument(document)};
    }));

    // A file answer, not JSON, so this read does not use runRead.
    server.app.get('/rest/v1/documents/:idOrHash/file', needDocuments, async (req, res) => {
        try {
            const document = await accessibleDocument(models, req.apiUserId, req.params.idOrHash, tokenCan(server, req));
            if (document.type !== docTypes.DOC_TYPE_PDF && document.type !== docTypes.DOC_TYPE_ZIP) {
                return res.status(400).json({message: 'errors.rest.documentHasNoBinaryFile'});
            }
            const filePath = storedFilePath(document);
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({message: 'errors.rest.documentFileMissing'});
            }
            const filename = document.originalFilename
                || (document.name + (document.type === docTypes.DOC_TYPE_PDF ? '.pdf' : '.zip'));
            // res.download encodes any file name safely in Content-Disposition (RFC 6266).
            return res.download(filePath, filename);
        } catch (err) {
            if (sendKnownError(res, err, DOCUMENT_ERRORS)) {
                return;
            }
            server.logger.error('REST get document file failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.put('/rest/v1/documents/:idOrHash/file', needDocuments, heavyRateLimit(server), uploadFiles(1), (req, res) => {
        // Files written before a failure are removed again after rollback, never after commit.
        const writtenFiles = [];
        return runWrite(server, req, res, {
            label: 'replace document file',
            notFound: 'errors.rest.documentNotFound',
            errors: DOCUMENT_ERRORS,
            writtenFiles,
            onRollback: () => removeWrittenFiles(writtenFiles, server.logger),
        }, async (options) => {
            const uploaded = uploadedFile(req);
            if (!uploaded) {
                throw new TranslatableError('errors.rest.fileRequired');
            }
            const result = await replaceDocumentFile({
                userId: req.apiUserId,
                idOrHash: req.params.idOrHash,
                file: uploaded.data,
                name: uploaded.name,
            }, options);
            return result === null ? null : {documentId: result.documentId, hash: result.hash};
        });
    });

    // Text of an HTML or modal document. PDF and ZIP documents use /file instead.
    server.app.get('/rest/v1/documents/:idOrHash/content', needDocuments, (req, res) => read(req, res, 'get document content', async (options) => {
        const document = await accessibleDocument(models, req.apiUserId, req.params.idOrHash, options.can);
        if (document.type !== docTypes.DOC_TYPE_HTML && document.type !== docTypes.DOC_TYPE_MODAL) {
            throw new TranslatableError('errors.rest.documentHasNoText');
        }
        const content = await readDocumentContent({document}, options);
        return {document: publicDocument(document), ...content};
    }));

    // Read-only notes on a document. The caller needs access to the document itself first.
    for (const [path, key, list] of [
        ['annotations', 'annotations', listDocumentAnnotations],
        ['comments', 'comments', listDocumentComments],
    ]) {
        server.app.get(`/rest/v1/documents/:idOrHash/${path}`, needDocuments, (req, res) => read(req, res, `list document ${path}`, async (options) => {
            const document = await accessibleDocument(models, req.apiUserId, req.params.idOrHash, options.can);
            return {[key]: await list({userId: req.apiUserId, documentId: document.id}, options)};
        }));
    }

    server.app.get('/rest/v1/documents/:idOrHash', needDocuments, (req, res) => read(req, res, 'get document', async (options) => {
        const document = await accessibleDocument(models, req.apiUserId, req.params.idOrHash, options.can);
        return {document: publicDocument(document)};
    }));

    server.app.patch('/rest/v1/documents/:idOrHash', needDocuments, (req, res) => runWrite(server, req, res, {
        label: 'patch document',
        errors: DOCUMENT_ERRORS,
    }, async (options) => {
        const document = await accessibleDocument(models, req.apiUserId, req.params.idOrHash, options.can);
        const fields = {};
        if (req.body?.name !== undefined) {
            if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
                throw new TranslatableError('errors.rest.documentNameRequired');
            }
            fields.name = req.body.name.trim();
        }
        if (req.body?.public !== undefined) {
            if (typeof req.body.public !== 'boolean') {
                throw new TranslatableError('errors.rest.invalidPublicFlag');
            }
            fields.public = req.body.public;
        }
        if (Object.keys(fields).length === 0) {
            throw new TranslatableError('errors.rest.noDocumentFields');
        }
        const updated = await updateDocumentFields({userId: req.apiUserId, documentId: document.id, fields}, options);
        return {document: publicDocument(updated)};
    }));

    server.app.delete('/rest/v1/documents/:idOrHash', needDocuments, (req, res) => runWrite(server, req, res, {
        label: 'delete document',
        notFound: 'errors.rest.documentNotFound',
        errors: DOCUMENT_ERRORS,
    }, async (options) => {
        const document = await loadDocumentByIdOrHash(models, req.params.idOrHash);
        if (!document) {
            return null;
        }
        if (!ownsDocument(req.apiUserId, document)) {
            throw new TranslatableError('errors.rest.documentNoAccess');
        }
        await models['document'].deleteById(document.id, {transaction: options.transaction});
        return {success: true};
    }));
}

module.exports = {registerRestDocumentRoutes};
