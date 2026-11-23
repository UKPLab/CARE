'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');
const {restChangeBatch} = require('../../utils/restBroadcast');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead, restOptions} = require('./routeHelpers');
const {listStudies, listStudyTemplates, createStudy, updateStudyFields, publicStudiesWithLimits} = require('../../rest/studies');
const {closeStudies, openStudies, deleteStudies} = require('../../rest/studyActions');
const {saveStudyAsTemplate, exportStudy, importStudies} = require('../../rest/studyTransfer');
const {STUDY_ERRORS, sendRestError, listedStudy, existingStudy, readStudyIds, readStudyFields, readImportStudies, exportFormat, readImportItems} = require('./studyInput');

const STUDIES_VIEW = 'frontend.dashboard.studies.view';
const STUDIES_MANAGE = 'frontend.dashboard.studies.canManageStudies';

/**
 * REST studies: collection, item, and extra paths for open/close/delete/template/import/export.
 *
 * @param {Server} server main server instance
 */
function registerRestStudyRoutes(server) {
    const needView = requireTokenRight(server, STUDIES_VIEW);
    const needManage = requireTokenRight(server, STUDIES_MANAGE);
    const read = (req, res, label, work) => runRead(server, req, res, {label, errors: STUDY_ERRORS}, work);
    // Public study fields plus the study's AI cost limits, for every study in an answer.
    const shown = (options, studies) => publicStudiesWithLimits(options.models, studies, options.transaction);
    const shownOne = async (options, study) => (await shown(options, [study]))[0];
    const write = (req, res, status, label, work) => runWrite(server, req, res, {status, label, errors: STUDY_ERRORS}, work);

    /**
     * Bulk open, close, and delete commit one study at a time (one failing study does not undo the
     * others) and refresh dashboards once at the end, like the dashboard's bulk actions.
     *
     * @param {Object} req express request
     * @param {Object} res express response
     * @param {string} label the action name for the log
     * @param {Function} action receives the study ids and the options, returns the response body
     * @returns {Object|Promise<Object>} the response
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
        return {studies: await shown(options, studies || [])};
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
            return {studies: await shown(options, studies)};
        });
    });

    server.app.post('/rest/v1/studies/close', needManage, heavyRateLimit(server), (req, res) =>
        bulk(req, res, 'bulk close studies', async (studyIds, options) => {
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds,
                notifySessions: req.body?.notifySessions === true,
            }, options);
            return {closedCount: result.closedCount, studies: await shown(options, result.studies)};
        }));

    server.app.post('/rest/v1/studies/open', needManage, heavyRateLimit(server), (req, res) =>
        bulk(req, res, 'bulk open studies', async (studyIds, options) => {
            const result = await openStudies({userId: req.apiUserId, studyIds}, options);
            return {openedCount: result.openedCount, studies: await shown(options, result.studies)};
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
                aiLimits: parsed.aiLimits,
            }, options);
            return {study: await shownOne(options, study)};
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
            return {study: await shownOne(options, await saveStudyAsTemplate({userId: req.apiUserId, id: study.id}, options))};
        }));

    server.app.post('/rest/v1/studies/:idOrHash/close', needManage, (req, res) =>
        write(req, res, 200, 'close study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const result = await closeStudies({
                userId: req.apiUserId,
                studyIds: [study.id],
                notifySessions: req.body?.notifySessions === true,
            }, options);
            return {study: await shownOne(options, result.studies[0])};
        }));

    server.app.post('/rest/v1/studies/:idOrHash/open', needManage, (req, res) =>
        write(req, res, 200, 'open study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const result = await openStudies({userId: req.apiUserId, studyIds: [study.id]}, options);
            return {study: await shownOne(options, result.studies[0])};
        }));

    server.app.get('/rest/v1/studies/:idOrHash', needView, (req, res) => read(req, res, 'get study', async (options) =>
        ({study: await shownOne(options, await listedStudy(req.apiUserId, req.params.idOrHash, options))})));

    server.app.patch('/rest/v1/studies/:idOrHash', needManage, (req, res) => {
        const parsed = readStudyFields(req.body);
        if (parsed.error) {
            return res.status(400).json({message: parsed.error});
        }
        if (Object.keys(parsed.fields).length === 0 && !parsed.stepDocuments && Object.keys(parsed.aiLimits).length === 0) {
            return res.status(400).json({message: 'errors.rest.noStudyFields'});
        }
        return write(req, res, 200, 'patch study', async (options) => {
            const study = await existingStudy(req.params.idOrHash, options);
            const updated = await updateStudyFields({
                userId: req.apiUserId,
                studyId: study.id,
                fields: parsed.fields,
                stepDocuments: parsed.stepDocuments,
                aiLimits: parsed.aiLimits,
            }, options);
            return {study: await shownOne(options, updated)};
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
