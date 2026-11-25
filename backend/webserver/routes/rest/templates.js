'use strict';

const TranslatableError = require('../../../utils/TranslatableError');
const {requireTokenRight} = require('../../middleware/bearerAuth');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {listTemplates, exportTemplates, importTemplate, createTemplate, updateTemplate, setTemplateContent, removeTemplateLanguage, copyTemplate, deleteTemplate} = require('../../rest/templates');

const TEMPLATE_ERRORS = {
    notFound: new Set(['errors.templates.notFound', 'errors.rest.templateLanguageNotFound']),
    forbidden: new Set(['errors.rest.templateNoAccess']),
};
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

const TEMPLATES_VIEW = 'frontend.dashboard.templates.view';

/**
 * REST templates: document, study, and prompt templates. Study templates (studies marked as
 * template) are a different thing and live under /rest/v1/study-templates.
 *
 * @param {Server} server main server instance
 */
function registerRestTemplateRoutes(server) {
    const needView = requireTokenRight(server, TEMPLATES_VIEW);

    server.app.get('/rest/v1/templates', needView, (req, res) => runRead(server, req, res, {
        label: 'list templates',
        errors: TEMPLATE_ERRORS,
    }, async (options) => ({templates: await listTemplates({userId: req.apiUserId}, options)})));

    server.app.get('/rest/v1/templates/export', needView, (req, res) => runRead(server, req, res, {
        label: 'export templates',
        notFound: 'errors.templates.notFound',
        errors: TEMPLATE_ERRORS,
    }, async (options) => {
        let templateId = null;
        if (req.query.id !== undefined) {
            if (!/^\d+$/.test(String(req.query.id))) {
                throw new TranslatableError('errors.rest.invalidTemplateId');
            }
            templateId = Number(req.query.id);
        }
        const templates = await exportTemplates({userId: req.apiUserId, templateId}, options);
        return templates === null ? null : {templates};
    }));

    server.app.post('/rest/v1/templates/import', needView, heavyRateLimit(server), (req, res) => {
        // Accepts what export returns ({templates: [...]}), a bare array, or one item.
        const body = is.object(req.body) && Array.isArray(req.body.templates) ? req.body.templates : req.body;
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0 || items.some((item) => !is.object(item))) {
            return res.status(400).json({message: 'errors.rest.templateImportRequired'});
        }
        return runWrite(server, req, res, {status: 201, label: 'import templates', errors: TEMPLATE_ERRORS}, async (options) => {
            const templates = [];
            for (const item of items) {
                templates.push(await importTemplate({userId: req.apiUserId, item}, options));
            }
            return {templates};
        });
    });

    const spec = (label, extra = {}) => ({label, notFound: 'errors.templates.notFound', errors: TEMPLATE_ERRORS, ...extra});
    const textFields = {name: is.text, description: is.text, defaultLanguage: (value) => typeof value === 'string' && LANGUAGE.test(value)};

    server.app.post('/rest/v1/templates', needView, (req, res) => {
        const parsed = readFields(req.body, textFields);
        if (parsed.error || !parsed.fields.name || !parsed.fields.description || !Number.isInteger(req.body?.type)) {
            return res.status(400).json({message: 'errors.rest.invalidTemplateField'});
        }
        return runWrite(server, req, res, spec('create template', {status: 201}), async (options) =>
            ({template: await createTemplate({userId: req.apiUserId, ...parsed.fields, type: req.body.type}, options)}));
    });

    server.app.patch('/rest/v1/templates/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, textFields);
        if (parsed.error || Object.keys(parsed.fields).length === 0) {
            return res.status(400).json({message: 'errors.rest.invalidTemplateField'});
        }
        return runWrite(server, req, res, spec('update template'), async (options) => {
            const template = id && await updateTemplate({userId: req.apiUserId, id, fields: parsed.fields}, options);
            return template ? {template} : null;
        });
    });

    server.app.put('/rest/v1/templates/:id/content/:language', needView, (req, res) => {
        const id = readId(req.params.id);
        const content = Array.isArray(req.body?.ops) ? {ops: req.body.ops} : req.body?.content;
        if (!LANGUAGE.test(req.params.language) || !content || !Array.isArray(content.ops)) {
            return res.status(400).json({message: 'errors.rest.invalidTemplateField'});
        }
        return runWrite(server, req, res, spec('set template content'), async (options) =>
            (id && await setTemplateContent({userId: req.apiUserId, id, language: req.params.language, content}, options)) || null);
    });

    server.app.delete('/rest/v1/templates/:id/content/:language', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('remove template language'), async (options) =>
            (id && await removeTemplateLanguage({userId: req.apiUserId, id, language: req.params.language}, options))
                ? {success: true} : null);
    });

    server.app.post('/rest/v1/templates/:id/copy', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('copy template', {status: 201}), async (options) => {
            const template = id && await copyTemplate({userId: req.apiUserId, sourceId: id}, options);
            return template ? {template} : null;
        });
    });

    server.app.delete('/rest/v1/templates/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete template'), async (options) =>
            (id && await deleteTemplate({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });
}

module.exports = {registerRestTemplateRoutes};
