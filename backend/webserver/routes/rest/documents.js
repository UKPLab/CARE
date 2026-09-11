'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');

const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';

/**
 * First REST slice: list the token owner's documents, create a blank HTML document.
 */
function registerRestDocumentRoutes(server) {
    const models = server.db.models;
    const needDocuments = requireTokenRight(server, DOCUMENTS_VIEW);

    server.app.get('/rest/v1/documents', needDocuments, async (req, res) => {
        try {
            const documents = await models['document'].getAllByKey('userId', req.apiUserId);
            return res.status(200).json({documents: documents || []});
        } catch (err) {
            server.logger.error('REST list documents failed: ' + err);
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
                ? models['document'].docTypes.DOC_TYPE_HTML
                : Number(req.body.type);
            if (type !== models['document'].docTypes.DOC_TYPE_HTML) {
                await t.rollback();
                return res.status(400).json({message: 'errors.rest.unsupportedDocumentType'});
            }
            const data = {
                name,
                type,
                userId: req.apiUserId,
            };
            if (req.body?.projectId !== undefined && req.body.projectId !== null) {
                data.projectId = Number(req.body.projectId);
                if (!Number.isInteger(data.projectId)) {
                    await t.rollback();
                    return res.status(400).json({message: 'errors.rest.invalidProjectId'});
                }
            }
            const document = await models['document'].add(data, {transaction: t});
            await t.commit();
            return res.status(201).json({document});
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            server.logger.error('REST create document failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerRestDocumentRoutes};
