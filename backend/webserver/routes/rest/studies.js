'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');
const TranslatableError = require('../../../utils/TranslatableError');
const StudySocket = require('../../sockets/study');

const STUDIES_VIEW = 'frontend.dashboard.studies.view';
const STUDIES_MANAGE = 'frontend.dashboard.studies.canManageStudies';

const {
    STUDY_FIELDS,
    listStudies,
    loadStudyByIdOrHash,
    studyVisibleInList,
    createStudy,
    updateStudyFields,
    closeStudies,
    openStudies,
    deleteStudies,
    saveStudyAsTemplate,
    exportStudy,
    importStudies,
    parseStudyImport,
} = StudySocket;

const BOOLEAN_FIELDS = new Set([
    'enableEmailNotifications',
    'collab',
    'anonymize',
    'resumable',
    'multipleSubmit',
]);
const INTEGER_FIELDS = new Set([
    'workflowId',
    'tagSetId',
    'timeLimit',
    'limitSessions',
    'limitSessionsPerUser',
]);
const DATE_FIELDS = new Set(['start', 'end']);

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
    if (key === 'errors.studies.studyNotFound' || key === 'errors.rest.studyNotFound') {
        return res.status(404).json({message: 'errors.rest.studyNotFound'});
    }
    if (key === 'errors.rest.templateNotFound') {
        return res.status(404).json({message: 'errors.rest.templateNotFound'});
    }
    if (key === 'errors.studies.noPermissionCloseStudy'
        || key === 'errors.studies.noPermissionSaveAsTemplate'
        || key === 'errors.studies.noPermissionManageStudies'
        || key === 'errors.studies.notAllowedToSeeStudy'
        || key === 'errors.rest.studyNoAccess') {
        return res.status(403).json({message: 'errors.rest.studyNoAccess'});
    }
    if (key === 'errors.studies.studyAlreadyClosed') {
        return res.status(400).json({message: 'errors.rest.studyAlreadyClosed'});
    }
    if (key === 'errors.studies.studyIdRequired') {
        return res.status(400).json({message: 'errors.rest.studyIdsRequired'});
    }
    if (key) {
        return res.status(400).json({message: key});
    }
    return null;
}

function studyOptions(server, transaction) {
    return {
        transaction,
        models: server.db.models,
        logger: server.logger,
        server,
    };
}

async function loadListedStudy(models, userId, idOrHash, res) {
    const study = await loadStudyByIdOrHash(models, idOrHash);
    if (!study) {
        res.status(404).json({message: 'errors.rest.studyNotFound'});
        return null;
    }
    if (!(await studyVisibleInList(models, userId, study))) {
        res.status(403).json({message: 'errors.rest.studyNoAccess'});
        return null;
    }
    return study;
}

async function loadExistingStudy(models, idOrHash, res) {
    const study = await loadStudyByIdOrHash(models, idOrHash);
    if (!study) {
        res.status(404).json({message: 'errors.rest.studyNotFound'});
        return null;
    }
    return study;
}

function readStudyIds(body) {
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
        return {error: 'errors.rest.studyIdsRequired'};
    }
    const ids = [];
    for (const raw of body.ids) {
        const id = Number(raw);
        if (!Number.isInteger(id)) {
            return {error: 'errors.rest.invalidStudyIds'};
        }
        ids.push(id);
    }
    return {ids};
}

function readStudyFields(body) {
    const fields = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {fields};
    }
    for (const key of STUDY_FIELDS) {
        if (body[key] === undefined) {
            continue;
        }
        if (key === 'name' || key === 'description') {
            if (typeof body[key] !== 'string') {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = key === 'name' ? body[key].trim() : body[key];
            if (key === 'name' && !fields[key]) {
                return {error: 'errors.rest.studyNameRequired'};
            }
            continue;
        }
        if (BOOLEAN_FIELDS.has(key)) {
            if (typeof body[key] !== 'boolean') {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = body[key];
            continue;
        }
        if (INTEGER_FIELDS.has(key)) {
            if (body[key] === null) {
                fields[key] = null;
                continue;
            }
            const parsed = Number(body[key]);
            if (!Number.isInteger(parsed)) {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = parsed;
            continue;
        }
        if (DATE_FIELDS.has(key)) {
            if (body[key] !== null && typeof body[key] !== 'string') {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = body[key];
        }
    }
    let stepDocuments;
    if (body.stepDocuments !== undefined) {
        if (!Array.isArray(body.stepDocuments)) {
            return {error: 'errors.rest.invalidStudyField'};
        }
        stepDocuments = body.stepDocuments;
    }
    return {fields, stepDocuments};
}

function exportFormat(query) {
    const raw = typeof query?.format === 'string' ? query.format.toLowerCase() : 'json';
    if (raw === 'json') {
        return 'json';
    }
    if (raw === 'yaml' || raw === 'yml') {
        return 'yaml';
    }
    return null;
}

function readImportItems(body) {
    if (Array.isArray(body)) {
        return {items: body};
    }
    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
        return {error: 'errors.rest.importContentRequired'};
    }
    const format = body.format === 'yaml' || body.format === 'yml' ? 'yaml' : 'json';
    if (body.format !== undefined && format === 'json' && body.format !== 'json') {
        return {error: 'errors.rest.unsupportedExportFormat'};
    }
    try {
        return {items: parseStudyImport(body.content, format)};
    } catch (err) {
        if (restMessage(err) === 'errors.rest.importContentRequired') {
            return {error: 'errors.rest.importContentRequired'};
        }
        return {error: 'errors.rest.importParseFailed'};
    }
}

async function rollback(transaction) {
    try {
        await transaction.rollback();
    } catch (_rollbackError) {
        // already rolled back
    }
}

/**
 * REST studies: collection, item, and extra paths for open/close/delete/template/import/export.
 */
function registerRestStudyRoutes(server) {
    const models = server.db.models;
    const needView = requireTokenRight(server, STUDIES_VIEW);
    const needManage = requireTokenRight(server, STUDIES_MANAGE);

    server.app.get('/rest/v1/studies', needView, async (req, res) => {
        try {
            const studies = await listStudies({userId: req.apiUserId}, {models});
            return res.status(200).json({studies: studies || []});
        } catch (err) {
            server.logger.error('REST list studies failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/import', needManage, async (req, res) => {
        const parsed = readImportItems(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        const t = await server.db.sequelize.transaction();
        try {
            const studies = await importStudies({
                userId: req.apiUserId,
                items: parsed.items,
            }, studyOptions(server, t));
            await t.commit();
            return res.status(201).json({studies});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST import studies failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/close', needManage, async (req, res) => {
        const ids = readStudyIds(req.body);
        if (ids.error) {
            return res.status(400).json({message: ids.error});
        }
        try {
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds: ids.ids,
                notifySessions: req.body?.notifySessions === true,
            }, studyOptions(server));
            return res.status(200).json({closedCount: result.closedCount, studies: result.studies});
        } catch (err) {
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST bulk close studies failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/open', needManage, async (req, res) => {
        const ids = readStudyIds(req.body);
        if (ids.error) {
            return res.status(400).json({message: ids.error});
        }
        try {
            const result = await openStudies({
                userId: req.apiUserId,
                studyIds: ids.ids,
            }, studyOptions(server));
            return res.status(200).json({openedCount: result.openedCount, studies: result.studies});
        } catch (err) {
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST bulk open studies failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/delete', needManage, async (req, res) => {
        const ids = readStudyIds(req.body);
        if (ids.error) {
            return res.status(400).json({message: ids.error});
        }
        try {
            const result = await deleteStudies({
                userId: req.apiUserId,
                studyIds: ids.ids,
            }, studyOptions(server));
            return res.status(200).json({deletedCount: result.deletedCount});
        } catch (err) {
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST bulk delete studies failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies', needManage, async (req, res) => {
        if (req.body?.templateId === undefined || req.body?.templateId === null || req.body?.templateId === '') {
            return res.status(400).json({message: 'errors.rest.templateIdRequired'});
        }
        const templateId = Number(req.body.templateId);
        if (!Number.isInteger(templateId)) {
            return res.status(400).json({message: 'errors.rest.invalidTemplateId'});
        }
        const parsed = readStudyFields(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        const t = await server.db.sequelize.transaction();
        try {
            const study = await createStudy({
                userId: req.apiUserId,
                templateId,
                fields: parsed.fields,
                stepDocuments: parsed.stepDocuments,
            }, studyOptions(server, t));
            await t.commit();
            return res.status(201).json({study});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST create study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.get('/rest/v1/studies/:idOrHash/export', needManage, async (req, res) => {
        const format = exportFormat(req.query);
        if (!format) {
            return res.status(400).json({message: 'errors.rest.unsupportedExportFormat'});
        }
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                return;
            }
            const exported = await exportStudy({
                userId: req.apiUserId,
                studyId: study.id,
                format,
            }, studyOptions(server));
            if (!exported) {
                return res.status(404).json({message: 'errors.rest.studyNotFound'});
            }
            const type = format === 'yaml' ? 'application/yaml' : 'application/json';
            res.setHeader('Content-Type', `${type}; charset=utf-8`);
            res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
            return res.status(200).send(exported.body);
        } catch (err) {
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST export study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/:idOrHash/template', needManage, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                await rollback(t);
                return;
            }
            const template = await saveStudyAsTemplate({
                userId: req.apiUserId,
                id: study.id,
            }, studyOptions(server, t));
            await t.commit();
            return res.status(201).json({study: template});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST save study template failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/:idOrHash/close', needManage, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                await rollback(t);
                return;
            }
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds: [study.id],
                notifySessions: req.body?.notifySessions === true,
            }, studyOptions(server, t));
            await t.commit();
            return res.status(200).json({study: result.studies[0]});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST close study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/rest/v1/studies/:idOrHash/open', needManage, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                await rollback(t);
                return;
            }
            const result = await openStudies({
                userId: req.apiUserId,
                studyIds: [study.id],
            }, studyOptions(server, t));
            await t.commit();
            return res.status(200).json({study: result.studies[0]});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST open study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.get('/rest/v1/studies/:idOrHash', needView, async (req, res) => {
        try {
            const study = await loadListedStudy(models, req.apiUserId, req.params.idOrHash, res);
            if (!study) {
                return;
            }
            return res.status(200).json({study});
        } catch (err) {
            server.logger.error('REST get study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.patch('/rest/v1/studies/:idOrHash', needManage, async (req, res) => {
        const parsed = readStudyFields(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        if (Object.keys(parsed.fields).length === 0 && !parsed.stepDocuments) {
            return res.status(400).json({message: 'errors.rest.noStudyFields'});
        }
        const t = await server.db.sequelize.transaction();
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                await rollback(t);
                return;
            }
            const updated = await updateStudyFields({
                userId: req.apiUserId,
                studyId: study.id,
                fields: parsed.fields,
                stepDocuments: parsed.stepDocuments,
            }, studyOptions(server, t));
            await t.commit();
            return res.status(200).json({study: updated});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST patch study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.delete('/rest/v1/studies/:idOrHash', needManage, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            const study = await loadExistingStudy(models, req.params.idOrHash, res);
            if (!study) {
                await rollback(t);
                return;
            }
            await deleteStudies({
                userId: req.apiUserId,
                studyIds: [study.id],
            }, studyOptions(server, t));
            await t.commit();
            return res.status(200).json({success: true});
        } catch (err) {
            await rollback(t);
            if (sendRestError(res, err)) {
                return;
            }
            server.logger.error('REST delete study failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerRestStudyRoutes};
