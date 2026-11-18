'use strict';

const {requireTokenRight, requireAnyTokenRight} = require('../../middleware/bearerAuth');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {listProjects, getProject, publicProject, createProject, updateProject, deleteProject} = require('../../sockets/project');

const PROJECTS_VIEW = 'frontend.dashboard.projects.view';
const ERRORS = {
    notFound: new Set(['errors.rest.projectNotFound']),
    forbidden: new Set(['errors.rest.projectNoAccess']),
};
const FIELDS = {name: is.text, description: is.textOrEmpty, public: (value) => value === true, closed: is.bool};

/**
 * REST projects: list your own and public ones; create, change, publish, close, and delete your own.
 */
function registerRestProjectRoutes(server) {
    const models = server.db.models;
    // Reading also works with documents.view, since documents are put into projects.
    const needRead = requireAnyTokenRight(server, [PROJECTS_VIEW, 'frontend.dashboard.documents.view']);
    const needView = requireTokenRight(server, PROJECTS_VIEW);
    const spec = (label, extra = {}) => ({label, notFound: 'errors.rest.projectNotFound', errors: ERRORS, ...extra});
    // closed is a date in the database; the API takes true (close now) or false (reopen).
    const toRow = (fields) => ('closed' in fields ? {...fields, closed: fields.closed ? new Date() : null} : fields);

    server.app.get('/rest/v1/projects', needRead, (req, res) => runRead(server, req, res, spec('list projects'),
        async () => ({projects: (await listProjects({userId: req.apiUserId}, {models})).map(publicProject)})));

    server.app.get('/rest/v1/projects/:id', needRead, (req, res) => runRead(server, req, res, spec('get project'),
        async (options) => {
            const id = readId(req.params.id);
            const project = id && await getProject({userId: req.apiUserId, id}, options);
            return project ? {project: publicProject(project)} : null;
        }));

    server.app.post('/rest/v1/projects', needView, (req, res) => {
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty});
        if (parsed.error || !parsed.fields.name) {
            return res.status(400).json({message: 'errors.rest.invalidProjectField'});
        }
        return runWrite(server, req, res, spec('create project', {status: 201}), async (options) =>
            ({project: publicProject(await createProject({userId: req.apiUserId, ...parsed.fields}, options))}));
    });

    server.app.patch('/rest/v1/projects/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, FIELDS);
        if (parsed.error || Object.keys(parsed.fields).length === 0) {
            return res.status(400).json({message: 'errors.rest.invalidProjectField'});
        }
        return runWrite(server, req, res, spec('update project'), async (options) => {
            const updated = id && await updateProject({userId: req.apiUserId, id, fields: toRow(parsed.fields)}, options);
            return updated ? {project: publicProject(updated)} : null;
        });
    });

    server.app.delete('/rest/v1/projects/:id', needView, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete project'), async (options) =>
            (id && await deleteProject({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });
}

module.exports = {registerRestProjectRoutes};
