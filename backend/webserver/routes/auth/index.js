'use strict';

const { createEmailHelpers } = require('./emailHelpers');
const { registerVerificationRoutes } = require('./verification');
const { registerLoginRoutes } = require('./login');
const { registerPasswordRoutes } = require('./password');
const { registerRegistrationRoutes } = require('./registration');
const { createSharedHelpers } = require('./shared');
const { registerTwoFactorLoginFlowRoutes } = require('./twoFactor/loginFlow');
const { createTwoFactorHelpers } = require('./twoFactor/shared');
const { registerTwoFactorSettingsRoutes } = require('./twoFactor/settings');

/**
 * Register all authentication-related route modules.
 *
 * @param {Server} server main server instance
 */
module.exports = function registerAuthRoutes(server) {
    const shared = createSharedHelpers(server);
    const email = createEmailHelpers(server);
    const twoFactor = createTwoFactorHelpers(server, shared, email);
    const helpers = { email, shared, twoFactor };

    registerLoginRoutes(server, helpers);
    registerRegistrationRoutes(server, helpers);
    registerPasswordRoutes(server, helpers);
    registerVerificationRoutes(server, helpers);
    registerTwoFactorLoginFlowRoutes(server, helpers);
    registerTwoFactorSettingsRoutes(server, helpers);
};
