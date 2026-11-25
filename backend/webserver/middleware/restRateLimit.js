'use strict';

const {rateLimit, ipKeyGenerator} = require('express-rate-limit');

const WINDOW_MS = 60 * 1000;
const GENERAL_SETTING = 'system.auth.apiTokens.rateLimitPerMinute';
const HEAVY_SETTING = 'system.auth.apiTokens.heavyRateLimitPerMinute';
const GENERAL_DEFAULT = 120;
const HEAVY_DEFAULT = 20;
const FAILED_AUTH_SETTING = 'system.auth.apiTokens.failedAuthPerMinute';
const FAILED_AUTH_DEFAULT = 60;

/**
 * A rate limiter whose budget per minute comes from a setting. By default budgets count per user
 * across all their tokens, so extra tokens do not mean extra budget; such a limiter is mounted after
 * Bearer auth, so req.apiUserId is set.
 *
 * @param {Server} server main server instance
 * @param {string} setting the setting key with the budget
 * @param {number} fallback the budget when the setting is not a positive integer
 * @param {Object} [overrides] more express-rate-limit options, e.g. another keyGenerator
 * @returns {Function} express middleware
 */
function createLimiter(server, setting, fallback, overrides = {}) {
    return rateLimit({
        windowMs: WINDOW_MS,
        limit: async () => {
            // Read on every request, so a short-lived copy is used (cleared when a setting is saved).
            const value = Number(await server.db.models['setting'].getCached(setting));
            return Number.isInteger(value) && value > 0 ? value : fallback;
        },
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        identifier: setting,
        keyGenerator: (req) => `api_user:${req.apiUserId}`,
        handler: (req, res) => {
            res.status(429).json({message: 'errors.rest.rateLimitExceeded'});
        },
        ...overrides,
    });
}

/**
 * Per-IP budget for requests whose token is missing, wrong, expired, or revoked. Mounted before
 * Bearer auth, so floods of bad tokens are cut off before they cost database lookups. Only 401
 * answers count, so working scripts never use it up. Behind a reverse proxy, TRUST_PROXY must be set
 * so req.ip is the client's address and not the proxy's.
 *
 * @param {Server} server main server instance
 * @returns {Function} express middleware
 */
function createFailedAuthRateLimit(server) {
    return createLimiter(server, FAILED_AUTH_SETTING, FAILED_AUTH_DEFAULT, {
        keyGenerator: (req) => 'api_ip:' + ipKeyGenerator(req.ip),
        skipSuccessfulRequests: true,
        requestWasSuccessful: (req, res) => res.statusCode !== 401,
    });
}

/**
 * Budget for every REST request. Mounted once for all of /rest/v1.
 *
 * @param {Server} server main server instance
 * @returns {Function} express middleware
 */
function createRestRateLimit(server) {
    return createLimiter(server, GENERAL_SETTING, GENERAL_DEFAULT);
}

const heavyLimiters = new WeakMap();

/**
 * Smaller budget for expensive routes (uploads, bulk writes, imports, copies). A route that is
 * expensive adds heavyRateLimit(server) to its own definition, so the marking sits on the route.
 * All routes of one server share one counter.
 *
 * @param {Server} server main server instance
 * @returns {Function} express middleware
 */
function heavyRateLimit(server) {
    if (!heavyLimiters.has(server)) {
        heavyLimiters.set(server, createLimiter(server, HEAVY_SETTING, HEAVY_DEFAULT));
    }
    return heavyLimiters.get(server);
}

module.exports = {
    createFailedAuthRateLimit,
    createRestRateLimit,
    heavyRateLimit,
    GENERAL_SETTING,
    HEAVY_SETTING,
    GENERAL_DEFAULT,
    HEAVY_DEFAULT,
    FAILED_AUTH_SETTING,
    FAILED_AUTH_DEFAULT,
};
