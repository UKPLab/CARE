'use strict';

const {createBearerAuthMiddleware} = require('../../middleware/bearerAuth');
const {createRestRateLimit, createFailedAuthRateLimit} = require('../../middleware/restRateLimit');
const {restErrorText, restBodyErrors} = require('../../middleware/restErrorText');
const {createRestIdempotency} = require('../../middleware/restIdempotency');
const {registerRestDocumentRoutes} = require('./documents');
const {registerRestStudyRoutes} = require('./studies');
const {registerRestReviewAssignmentRoutes} = require('./reviewAssignments');
const {registerRestUserRoutes} = require('./users');
const {registerRestLookupRoutes} = require('./lookups');
const {registerRestSessionRoutes} = require('./sessions');
const {registerRestSubmissionRoutes} = require('./submissions');
const {registerRestTemplateRoutes} = require('./templates');
const {registerRestAssignmentRoutes} = require('./assignments');
const {registerRestProjectRoutes} = require('./projects');
const {registerRestTagRoutes} = require('./tags');
const {registerRestWorkflowRoutes} = require('./workflows');
const {registerRestConfigurationRoutes} = require('./configurations');

/**
 * Register the REST API under /rest/v1: its middleware, every route file, and the JSON 404.
 * Bearer tokens only; the cookie session is not used as identity here.
 *
 * @param {Server} server main server instance
 */
function registerRestRoutes(server) {
    // First, so every error below (auth, rights, rate limit, routes) carries the English text.
    server.app.use('/rest/v1', restErrorText);
    // Before auth, per IP: requests with a bad token are limited before they reach the database.
    server.app.use('/rest/v1', createFailedAuthRateLimit(server));
    server.app.use('/rest/v1', createBearerAuthMiddleware(server));
    server.app.use('/rest/v1', createRestRateLimit(server));
    server.app.use('/rest/v1', createRestIdempotency(server));
    registerRestDocumentRoutes(server);
    registerRestStudyRoutes(server);
    registerRestReviewAssignmentRoutes(server);
    registerRestUserRoutes(server);
    registerRestLookupRoutes(server);
    registerRestSessionRoutes(server);
    registerRestSubmissionRoutes(server);
    registerRestTemplateRoutes(server);
    registerRestAssignmentRoutes(server);
    registerRestProjectRoutes(server);
    registerRestTagRoutes(server);
    registerRestWorkflowRoutes(server);
    registerRestConfigurationRoutes(server);
    // An unknown /rest/v1 path ends here as JSON, before the session middleware and the HTML 404.
    server.app.use('/rest/v1', (req, res) => res.status(404).json({message: 'errors.rest.routeNotFound'}));
    // Last: catches broken or oversized JSON from the global body parser for /rest/v1 requests.
    server.app.use('/rest/v1', restBodyErrors);
}

module.exports = registerRestRoutes;
