'use strict';

const {createBearerAuthMiddleware} = require('../../middleware/bearerAuth');
const {createRestTokenRateLimit} = require('../../middleware/restRateLimit');
const {registerRestDocumentRoutes} = require('./documents');

/**
 * Bearer-only REST. Cookie session is not used as identity here.
 */
function registerRestRoutes(server) {
    server.app.use('/rest/v1', createBearerAuthMiddleware(server));
    server.app.use('/rest/v1', createRestTokenRateLimit());
    registerRestDocumentRoutes(server);
}

module.exports = registerRestRoutes;
