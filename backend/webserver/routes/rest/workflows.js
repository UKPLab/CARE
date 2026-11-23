'use strict';

const {requireTokenRight, requireAnyTokenRight} = require('../../middleware/bearerAuth');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {listWorkflows, getWorkflow, copyWorkflow, importWorkflows, updateWorkflow, replaceWorkflowSteps, deleteWorkflow, readSteps} = require('../../rest/workflows');

const WORKFLOWS_VIEW = 'frontend.dashboard.workflows.view';
const STUDIES_VIEW = 'frontend.dashboard.studies.view';
const ERRORS = {
    notFound: new Set(['errors.rest.workflowNotFound']),
    forbidden: new Set(['errors.rest.workflowNoAccess']),
};
const pick = (row) => ({id: row.id, name: row.name, description: row.description, userId: row.userId});

/**
 * REST workflows. Created by copying an existing one or importing the dashboard's export file;
 * own workflows can be renamed, deleted while unused, and have their steps replaced while unused.
 *
 * @param {Server} server main server instance
 */
function registerRestWorkflowRoutes(server) {
    const models = server.db.models;
    const needRead = requireAnyTokenRight(server, [WORKFLOWS_VIEW, STUDIES_VIEW]);
    const needWrite = requireTokenRight(server, WORKFLOWS_VIEW);
    const spec = (label, extra = {}) => ({label, notFound: 'errors.rest.workflowNotFound', errors: ERRORS, ...extra});

    server.app.get('/rest/v1/workflows', needRead, (req, res) => runRead(server, req, res, spec('list workflows'),
        async () => ({workflows: await listWorkflows({models})})));

    server.app.get('/rest/v1/workflows/:id', needRead, (req, res) => runRead(server, req, res, spec('get workflow'),
        async () => {
            const id = readId(req.params.id);
            const workflow = id && await getWorkflow({id}, {models});
            return workflow ? {workflow} : null;
        }));

    // Registered before /workflows/:id routes so "import" is not read as an id.
    server.app.post('/rest/v1/workflows/import', needWrite, heavyRateLimit(server), (req, res) => {
        const body = req.body && Array.isArray(req.body.workflows) ? req.body.workflows : req.body;
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0 || items.some((item) => !is.object(item))) {
            return res.status(400).json({message: 'errors.rest.invalidWorkflowImport'});
        }
        return runWrite(server, req, res, spec('import workflows', {status: 201}), async (options) => {
            const created = await importWorkflows({userId: req.apiUserId, items}, options);
            return {workflows: created.map(pick)};
        });
    });

    server.app.post('/rest/v1/workflows/:id/copy', needWrite, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, {name: is.text});
        if (parsed.error) {
            return res.status(400).json({message: 'errors.rest.invalidWorkflowField'});
        }
        return runWrite(server, req, res, spec('copy workflow', {status: 201}), async (options) => {
            const copy = id && await copyWorkflow({userId: req.apiUserId, sourceId: id, name: parsed.fields.name}, options);
            return copy ? {workflow: pick(copy)} : null;
        });
    });

    server.app.patch('/rest/v1/workflows/:id', needWrite, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty, hideInFrontend: is.bool});
        if (parsed.error || Object.keys(parsed.fields).length === 0) {
            return res.status(400).json({message: 'errors.rest.invalidWorkflowField'});
        }
        return runWrite(server, req, res, spec('update workflow'), async (options) => {
            const updated = id && await updateWorkflow({userId: req.apiUserId, id, fields: parsed.fields}, options);
            return updated ? {workflow: pick(updated)} : null;
        });
    });

    server.app.put('/rest/v1/workflows/:id/steps', needWrite, (req, res) => {
        const id = readId(req.params.id);
        const steps = readSteps(req.body?.steps);
        if (!steps) {
            return res.status(400).json({message: 'errors.rest.invalidWorkflowSteps'});
        }
        return runWrite(server, req, res, spec('replace workflow steps'), async (options) => {
            const workflow = id && await replaceWorkflowSteps({userId: req.apiUserId, id, steps}, options);
            return workflow ? {workflowId: workflow.id} : null;
        });
    });

    server.app.delete('/rest/v1/workflows/:id', needWrite, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete workflow'), async (options) =>
            (id && await deleteWorkflow({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });

}

module.exports = {registerRestWorkflowRoutes};
