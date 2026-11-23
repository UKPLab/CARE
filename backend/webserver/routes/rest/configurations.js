'use strict';

const {requireTokenRight} = require('../../middleware/bearerAuth');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {CONFIGURATION_TYPES, listConfigurations, getConfiguration, createConfiguration, updateConfiguration, deleteConfiguration} = require('../../rest/configurations');

const CONFIGURATIONS_MANAGE = 'frontend.dashboard.configurations.manage';
const ERRORS = {
    notFound: new Set(['errors.rest.configurationNotFound']),
    forbidden: new Set(['errors.rest.configurationNoAccess', 'errors.rest.missingTokenRight']),
};

/**
 * Read a configuration type: "assessment", "validation", "dialoguePlan", or the number 0, 1, 2.
 *
 * @param {*} raw the type value from the body
 * @returns {number|null} the type number, or null when it is not known
 */
function readType(raw) {
    if (Object.prototype.hasOwnProperty.call(CONFIGURATION_TYPES, raw)) {
        return CONFIGURATION_TYPES[raw];
    }
    return Object.values(CONFIGURATION_TYPES).includes(raw) ? raw : null;
}

/**
 * REST configurations: assessment rubrics and criteria, validation schemas, dialogue plans.
 * Reading needs any valid token (a public table in the dashboard); writing needs the manage right.
 *
 * @param {Server} server main server instance
 */
function registerRestConfigurationRoutes(server) {
    const models = server.db.models;
    const needManage = requireTokenRight(server, CONFIGURATIONS_MANAGE);
    const spec = (label, extra = {}) => ({label, notFound: 'errors.rest.configurationNotFound', errors: ERRORS, ...extra});

    server.app.get('/rest/v1/configurations', (req, res) => runRead(server, req, res, spec('list configurations'),
        async () => ({configurations: await listConfigurations({userId: req.apiUserId}, {models})})));

    server.app.get('/rest/v1/configurations/:id', (req, res) => runRead(server, req, res, spec('get configuration'),
        async (options) => {
            const id = readId(req.params.id);
            const configuration = id && await getConfiguration({userId: req.apiUserId, id}, options);
            return configuration ? {configuration} : null;
        }));

    server.app.post('/rest/v1/configurations', needManage, (req, res) => {
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty, content: is.object, hideInFrontend: is.bool});
        const type = readType(req.body?.type);
        if (parsed.error || !parsed.fields.name || !parsed.fields.content || type === null) {
            return res.status(400).json({message: 'errors.rest.invalidConfigurationField'});
        }
        return runWrite(server, req, res, spec('create configuration', {status: 201}), async (options) =>
            ({configuration: await createConfiguration({userId: req.apiUserId, ...parsed.fields, type}, options)}));
    });

    server.app.patch('/rest/v1/configurations/:id', needManage, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty, content: is.object, hideInFrontend: is.bool});
        if (parsed.error || Object.keys(parsed.fields).length === 0) {
            return res.status(400).json({message: 'errors.rest.invalidConfigurationField'});
        }
        return runWrite(server, req, res, spec('update configuration'), async (options) => {
            const configuration = id && await updateConfiguration({userId: req.apiUserId, id, fields: parsed.fields}, options);
            return configuration ? {configuration} : null;
        });
    });

    server.app.delete('/rest/v1/configurations/:id', needManage, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete configuration'), async (options) =>
            (id && await deleteConfiguration({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });
}

module.exports = {registerRestConfigurationRoutes};
