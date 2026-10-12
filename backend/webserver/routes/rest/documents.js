'use strict';

const fileUpload = require('express-fileupload');
const fs = require('fs');
const {requireTokenRight} = require('../../middleware/bearerAuth');
const TranslatableError = require('../../../utils/TranslatableError');
const DocumentSocket = require('../../sockets/document');

const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';
const {
    createDocument,
    addDocument,
    listDocuments,
    updateDocumentFields,
    replaceDocumentFile,
    userHasDocumentAccess,
    userCanManageUser,
    loadDocumentByIdOrHash,
    storedFilePath,
    docTypes,
} = DocumentSocket;

const uploadFiles = fileUpload();

function restMessage(err) {
    if (TranslatableError.is && TranslatableError.is(err)) {
        return err.key;
    }
    if (err && err.key) {
        return err.key;
    }
    if (err && typeof err.message === 'string' && err.message.startsWith('errors.')) {
        return err.message;
    }
    return null;
}

function sendRestError(res, err) {
    const key = restMessage(err);
    if (key === 'errors.documents.updateNotAllowed'
        || key === 'errors.documents.noAccess'
        || key === 'errors.documents.replaceFileNoPermission'
        || key === 'errors.documents.noUploadAccess') {
        return res.status(403).json({message: 'errors.rest.documentNoAccess'});
    }
    if (key === 'errors.documents.doesNotExistOrDeleted' || (err && err.code === 'DOCUMENT_NOT_FOUND')) {
        return res.status(404).json({message: 'errors.rest.documentNotFound'});
    }
    if (key) {
        return res.status(400).json({message: key});
    }
    return null;
}

async function loadAccessibleDocument(models, userId, idOrHash, res) {
    const document = await loadDocumentByIdOrHash(models, idOrHash);
    if (!document) {
        res.status(404).json({message: 'errors.rest.documentNotFound'});
        return null;
    }
    if (!(await userHasDocumentAccess(models, userId, document.id))) {
        res.status(403).json({message: 'errors.rest.documentNoAccess'});
        return null;
    }
    return document;
}

function uploadedFile(req) {
    const raw = req.files && req.files.file;
    if (!raw) {
        return null;
    }
    return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * REST documents: collection, item, and /upload for file create/get/replace.
 */
function registerRestDocumentRoutes(server) {
    const models = server.db.models;
    const needDocuments = requireTokenRight(server, DOCUMENTS_VIEW);

    server.app.get('/rest/v1/documents', needDocuments, async (req, res) => {
        try {
            const documents = await listDocuments(
                {userId: req.apiUserId},
                {models}
            );
            return res.status(200).json({documents: documents || []});
        } catch (err) {
            server.logger.error('REST list documents failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/documents/upload', needDocuments, uploadFiles, async (req, res) => {
        const uploaded = uploadedFile(req);
        if (!uploaded) {
            return res.status(400).json({message: 'errors.rest.fileRequired'});
        }
        const t = await server.db.sequelize.transaction();
        try {
            const result = await addDocument({
                actingUserId: req.apiUserId,
                file: uploaded.data,
                name: uploaded.name,
                type: req.body?.type !== undefined ? Number(req.body.type) : undefined,
                projectId: req.body?.projectId !== undefined ? Number(req.body.projectId) : undefined,
                importAnnotations: req.body?.importAnnotations === 'true' || req.body?.importAnnotations === true,
            }, {
                transaction: t,
                models,
                server,
                logger: server.logger,
            });
            await t.commit();
            return res.status(201).json({
                document: result.doc,
                annotations: result.annotations,
                errors: result.errors,
            });
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST upload document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/documents', needDocuments, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
            if (!name) {
                await t.rollback();
                return res.status(400).json({message: 'errors.rest.documentNameRequired'});
            }
            const type = req.body?.type === undefined
                ? docTypes.DOC_TYPE_HTML
                : Number(req.body.type);
            if (type !== docTypes.DOC_TYPE_HTML && type !== docTypes.DOC_TYPE_MODAL) {
                await t.rollback();
                return res.status(400).json({message: 'errors.rest.unsupportedDocumentType'});
            }
            let projectId;
            if (req.body?.projectId !== undefined && req.body.projectId !== null) {
                projectId = Number(req.body.projectId);
                if (!Number.isInteger(projectId)) {
                    await t.rollback();
                    return res.status(400).json({message: 'errors.rest.invalidProjectId'});
                }
            }
            let templateId;
            if (req.body?.templateId) {
                templateId = Number(req.body.templateId);
                if (!Number.isInteger(templateId)) {
                    await t.rollback();
                    return res.status(400).json({message: 'errors.rest.invalidTemplateId'});
                }
            }
            const document = await createDocument({
                userId: req.apiUserId,
                name,
                type,
                templateId,
                projectId,
            }, {
                transaction: t,
                models,
                logger: server.logger,
            });
            await t.commit();
            return res.status(201).json({document});
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST create document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.get('/rest/v1/documents/:idOrHash/upload', needDocuments, async (req, res) => {
        try {
            const document = await loadAccessibleDocument(models, req.apiUserId, req.params.idOrHash, res);
            if (!document) {
                return;
            }
            if (document.type !== docTypes.DOC_TYPE_PDF && document.type !== docTypes.DOC_TYPE_ZIP) {
                return res.status(400).json({message: 'errors.rest.documentHasNoBinaryFile'});
            }
            const filePath = storedFilePath(document);
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({message: 'errors.rest.documentFileMissing'});
            }
            const filename = document.originalFilename
                || (document.name + (document.type === docTypes.DOC_TYPE_PDF ? '.pdf' : '.zip'));
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.sendFile(filePath);
        } catch (err) {
            server.logger.error('REST get document file failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.put('/rest/v1/documents/:idOrHash/upload', needDocuments, uploadFiles, async (req, res) => {
        const uploaded = uploadedFile(req);
        if (!uploaded) {
            return res.status(400).json({message: 'errors.rest.fileRequired'});
        }
        const t = await server.db.sequelize.transaction();
        try {
            const result = await replaceDocumentFile({
                userId: req.apiUserId,
                idOrHash: req.params.idOrHash,
                file: uploaded.data,
                name: uploaded.name,
            }, {
                transaction: t,
                models,
                server,
                logger: server.logger,
            });
            if (result === null) {
                await t.rollback();
                return res.status(404).json({message: 'errors.rest.documentNotFound'});
            }
            await t.commit();
            return res.status(200).json(result);
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST replace document file failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.get('/rest/v1/documents/:idOrHash', needDocuments, async (req, res) => {
        try {
            const document = await loadAccessibleDocument(models, req.apiUserId, req.params.idOrHash, res);
            if (!document) {
                return;
            }
            return res.status(200).json({document});
        } catch (err) {
            server.logger.error('REST get document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.patch('/rest/v1/documents/:idOrHash', needDocuments, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const document = await loadAccessibleDocument(models, req.apiUserId, req.params.idOrHash, res);
            if (!document) {
                await t.rollback();
                return;
            }
            const fields = {};
            if (req.body?.name !== undefined) {
                if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
                    await t.rollback();
                    return res.status(400).json({message: 'errors.rest.documentNameRequired'});
                }
                fields.name = req.body.name.trim();
            }
            if (req.body?.public !== undefined) {
                if (typeof req.body.public !== 'boolean') {
                    await t.rollback();
                    return res.status(400).json({message: 'errors.rest.invalidPublicFlag'});
                }
                fields.public = req.body.public;
            }
            if (Object.keys(fields).length === 0) {
                await t.rollback();
                return res.status(400).json({message: 'errors.rest.noDocumentFields'});
            }
            const updated = await updateDocumentFields({
                userId: req.apiUserId,
                documentId: document.id,
                fields,
            }, {transaction: t, models});
            await t.commit();
            return res.status(200).json({document: updated});
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST patch document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.delete('/rest/v1/documents/:idOrHash', needDocuments, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const document = await loadDocumentByIdOrHash(models, req.params.idOrHash);
            if (!document) {
                await t.rollback();
                return res.status(404).json({message: 'errors.rest.documentNotFound'});
            }
            if (!(await userCanManageUser(models, req.apiUserId, document.userId))) {
                await t.rollback();
                return res.status(403).json({message: 'errors.rest.documentNoAccess'});
            }
            await models['document'].deleteById(document.id, {transaction: t});
            await t.commit();
            return res.status(200).json({success: true});
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            server.logger.error('REST delete document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerRestDocumentRoutes};
