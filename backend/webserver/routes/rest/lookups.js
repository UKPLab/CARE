'use strict';

const {describeToken} = require('../../utils/apiTokenAuth');
const {listRoles} = require('../../sockets/user');

/**
 * Read-only routes: who the token is, and the roles review assignments and shares refer to.
 * Projects, workflows, tag sets, and study templates have their own route files.
 */
function registerRestLookupRoutes(server) {
    const models = server.db.models;

    // Any valid token may ask what it is and what it can do.
    server.app.get('/rest/v1/me', async (req, res) => {
        try {
            return res.status(200).json(await describeToken(models, req.apiToken, req.apiAccess));
        } catch (err) {
            server.logger.error('REST me failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    // Role names are public in the dashboard. A valid token is enough.
    server.app.get('/rest/v1/roles', async (req, res) => {
        try {
            return res.status(200).json({roles: await listRoles({models})});
        } catch (err) {
            server.logger.error('REST roles failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerRestLookupRoutes};
