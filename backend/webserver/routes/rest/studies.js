'use strict';

const TranslatableError = require('../../../utils/TranslatableError');
const {requireTokenRight} = require('../../middleware/bearerAuth');
const {restChangeBatch} = require('../../utils/restBroadcast');
const {sendKnownError, errorKey} = require('../../utils/restHelpers');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead, restOptions, is} = require('./routeHelpers');
const StudySocket = require('../../sockets/study');

const STUDIES_VIEW = 'frontend.dashboard.studies.view';
const STUDIES_MANAGE = 'frontend.dashboard.studies.canManageStudies';

const {
    STUDY_FIELDS,
    listStudies,
    publicStudy,
    listStudyTemplates,
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
    stepDocumentsFromStudySteps,
} = StudySocket;

// Socket error keys mapped to the REST keys the docs promise.
const STUDY_ERRORS = {
    rename: {
        'errors.studies.studyNotFound': 'errors.rest.studyNotFound',
        'errors.studies.noPermissionCloseStudy': 'errors.rest.studyNoAccess',
        'errors.studies.noPermissionSaveAsTemplate': 'errors.rest.studyNoAccess',
        'errors.studies.noPermissionManageStudies': 'errors.rest.studyNoAccess',
        'errors.studies.notAllowedToSeeStudy': 'errors.rest.studyNoAccess',
        'errors.studies.studyAlreadyClosed': 'errors.rest.studyAlreadyClosed',
        'errors.studies.studyIdRequired': 'errors.rest.studyIdsRequired',
    },
    notFound: new Set(['errors.rest.studyNotFound', 'errors.rest.templateNotFound']),
    forbidden: new Set(['errors.rest.studyNoAccess', 'errors.rest.documentNoAccess']),
};

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
// Bulk open, close, and delete take at most this many ids per request.
const MAX_BULK_STUDY_IDS = 100;

function sendRestError(res, err) {
    return sendKnownError(res, err, STUDY_ERRORS);
}

/**
 * A study the caller may see in the list.
 * @throws {TranslatableError} errors.rest.studyNotFound (404) or errors.rest.studyNoAccess (403)
 */
async function listedStudy(userId, idOrHash, options) {
    const study = await existingStudy(idOrHash, options);
    if (!(await studyVisibleInList(options.models, userId, study, options.can))) {
        throw new TranslatableError('errors.rest.studyNoAccess');
    }
    return study;
}

/** @throws {TranslatableError} errors.rest.studyNotFound (404) */
async function existingStudy(idOrHash, options) {
    const study = await loadStudyByIdOrHash(options.models, idOrHash);
    if (!study) {
        throw new TranslatableError('errors.rest.studyNotFound');
    }
    return study;
}

function readStudyIds(body) {
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
        return {error: 'errors.rest.studyIdsRequired'};
    }
    if (body.ids.length > MAX_BULK_STUDY_IDS) {
        return {error: 'errors.rest.tooManyStudyIds'};
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
            if (!is.dateOrNull(body[key])) {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = body[key];
        }
    }
    let stepDocuments;
    if (body.stepDocuments !== undefined) {
        stepDocuments = readStepDocuments(body.stepDocuments);
        if (!stepDocuments) {
            return {error: 'errors.rest.invalidStudyField'};
        }
    }
    return {fields, stepDocuments};
}

/**
 * Each entry is { id: workflowStepId, documentId?, configuration? }. Other keys are dropped.
 * @returns {Array|null} null when the shape is wrong
 */
function readStepDocuments(raw) {
    if (!Array.isArray(raw)) {
        return null;
    }
    const steps = [];
    for (const step of raw) {
        if (!step || typeof step !== 'object' || Array.isArray(step) || !Number.isInteger(step.id)) {
            return null;
        }
        const documentId = step.documentId ?? null;
        if (documentId !== null && !Number.isInteger(documentId)) {
            return null;
        }
        const configuration = step.configuration ?? {};
        if (typeof configuration !== 'object' || Array.isArray(configuration)) {
            return null;
        }
        steps.push({id: step.id, documentId, configuration});
    }
    return steps;
}

/**
 * Type-check each imported study the same way POST and PATCH do. Null values are treated as not set.
 */
function readImportStudies(items) {
    const studies = [];
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return {error: 'errors.rest.importContentRequired'};
        }
        // YAML parses timestamps into Date objects. The field check expects ISO strings.
        const present = Object.fromEntries(Object.entries(item)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
        const parsed = readStudyFields(present);
        if (parsed.error) {
            return {error: parsed.error};
        }
        let stepDocuments = parsed.stepDocuments;
        if (!stepDocuments && Array.isArray(item.study_step)) {
            // An export carries study_step rows; use them the way the dashboard import does.
            stepDocuments = readStepDocuments(stepDocumentsFromStudySteps(item.study_step.filter(is.object)));
            if (!stepDocuments) {
                return {error: 'errors.rest.invalidStudyField'};
            }
        }
        studies.push({...parsed.fields, stepDocuments});
    }
    return {items: studies};
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
        if (errorKey(err) === 'errors.rest.importContentRequired') {
            return {error: 'errors.rest.importContentRequired'};
        }
        return {error: 'errors.rest.importParseFailed'};
    }
}

/**
 * REST studies: collection, item, and extra paths for open/close/delete/template/import/export.
 */
function registerRestStudyRoutes(server) {
    const needView = requireTokenRight(server, STUDIES_VIEW);
    const needManage = requireTokenRight(server, STUDIES_MANAGE);
    const read = (req, res, label, work) => runRead(server, req, res, {label, errors: STUDY_ERRORS}, work);
    const write = (req, res, status, label, work) => runWrite(server, req, res, {status, label, errors: STUDY_ERRORS}, work);

    /**
     * Bulk open, close, and delete commit one study at a time (one failing study does not undo the
     * others) and refresh dashboards once at the end, like the dashboard's bulk actions.
     */
    function bulk(req, res, label, action) {
        const ids = readStudyIds(req.body);
        if (ids.error) {
            return res.status(400).json({message: ids.error});
        }
        const batch = restChangeBatch(server, req.apiUserId);
        return read(req, res, label, async (options) => {
            try {
                return await action(ids.ids, {...options, startTransaction: batch.start});
            } finally {
                await batch.broadcast();
            }
        });
    }

    server.app.get('/rest/v1/studies', needView, (req, res) => read(req, res, 'list studies', async (options) => {
        const studies = await listStudies({userId: req.apiUserId}, options);
        return {studies: (studies || []).map(publicStudy)};
    }));

    server.app.get('/rest/v1/study-templates', needView, (req, res) => read(req, res, 'list study templates', async (options) =>
        ({templates: await listStudyTemplates({userId: req.apiUserId}, options)})));

    server.app.post('/rest/v1/studies/import', needManage, heavyRateLimit(server), (req, res) => {
        const parsed = readImportItems(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        const checked = readImportStudies(parsed.items);
        if (checked.error) {
            return res.status(400).json({message: checked.error});
        }
        return write(req, res, 201, 'import studies', async (options) => {
            const studies = await importStudies({userId: req.apiUserId, items: checked.items}, options);
            return {studies: studies.map(publicStudy)};
        });
    });

    server.app.post('/rest/v1/studies/close', needManage, heavyRateLimit(server), (req, res) =>
        bulk(req, res, 'bulk close studies', async (studyIds, options) => {
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds,
                notifySessions: req.body?.notifySessions === true,
            }, options);
            return {closedCount: result.closedCount, studies: result.studies.map(publicStudy)};
        }));

    server.app.post('/rest/v1/studies/open', needManage, heavyRateLimit(server), (req, res) =>
        bulk(req, res, 'bulk open studies', async (studyIds, options) => {
            const result = await openStudies({userId: req.apiUserId, studyIds}, options);
            return {openedCount: result.openedCount, studies: result.studies.map(publicStudy)};
        }));

    server.app.post('/rest/v1/studies/delete', needManage, heavyRateLimit(server), (req, res) =>
        bulk(req, res, 'bulk delete studies', async (studyIds, options) => {
            const result = await deleteStudies({userId: req.apiUserId, studyIds}, options);
            return {deletedCount: result.deletedCount};
        }));

    server.app.post('/rest/v1/studies', needManage, (req, res) => {
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
        return write(req, res, 201, 'create study', async (options) => {
            const study = await createStudy({
                userId: req.apiUserId,
                templateId,
                fields: parsed.fields,
                stepDocuments: parsed.stepDocuments,
            }, options);
            return {study: publicStudy(study)};
        });
    });

    // A file answer, not JSON, so this read does not use runRead.
    server.app.get('/rest/v1/studies/:idOrHash/export', needManage, async (req, res) => {
        const format = exportFormat(req.query);
        if (!format) {
            return res.status(400).json({message: 'errors.rest.unsupportedExportFormat'});
        }
        try {
            const options = restOptions(server, req);
            const study = await existingStudy(req.params.idOrHash, options);
            const exported = await exportStudy({userId: req.apiUserId, studyId: study.id, format}, options);
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

    server.app.post('/rest/v1/studies/:idOrHash/template', needManage, (req, res) =>
        write(req, res, 201, 'save study template', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            return {study: publicStudy(await saveStudyAsTemplate({userId: req.apiUserId, id: study.id}, options))};
        }));

    server.app.post('/rest/v1/studies/:idOrHash/close', needManage, (req, res) =>
        write(req, res, 200, 'close study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds: [study.id],
                notifySessions: req.body?.notifySessions === true,
            }, options);
            return {study: publicStudy(result.studies[0])};
        }));

    server.app.post('/rest/v1/studies/:idOrHash/open', needManage, (req, res) =>
        write(req, res, 200, 'open study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const result = await openStudies({userId: req.apiUserId, studyIds: [study.id]}, options);
            return {study: publicStudy(result.studies[0])};
        }));

    server.app.get('/rest/v1/studies/:idOrHash', needView, (req, res) => read(req, res, 'get study', async (options) =>
        ({study: publicStudy(await listedStudy(req.apiUserId, req.params.idOrHash, options))})));

    server.app.patch('/rest/v1/studies/:idOrHash', needManage, (req, res) => {
        const parsed = readStudyFields(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        if (Object.keys(parsed.fields).length === 0 && !parsed.stepDocuments) {
            return res.status(400).json({message: 'errors.rest.noStudyFields'});
        }
        return write(req, res, 200, 'patch study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const updated = await updateStudyFields({
                userId: req.apiUserId,
                studyId: study.id,
                fields: parsed.fields,
                stepDocuments: parsed.stepDocuments,
            }, options);
            return {study: publicStudy(updated)};
        });
    });

    server.app.delete('/rest/v1/studies/:idOrHash', needManage, (req, res) =>
        write(req, res, 200, 'delete study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            await deleteStudies({userId: req.apiUserId, studyIds: [study.id]}, options);
            return {success: true};
        }));
}

module.exports = {registerRestStudyRoutes};
