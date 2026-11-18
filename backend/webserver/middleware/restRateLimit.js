'use strict';

const {rateLimit} = require('express-rate-limit');

const WINDOW_MS = 60 * 1000;
const GENERAL_SETTING = 'system.auth.apiTokens.rateLimitPerMinute';
const HEAVY_SETTING = 'system.auth.apiTokens.heavyRateLimitPerMinute';
const GENERAL_DEFAULT = 120;
const HEAVY_DEFAULT = 20;

/**
 * Budgets count per user across all their tokens, so extra tokens do not mean extra budget.
 * Mounted after Bearer auth, so req.apiUserId is set.
 */
function createLimiter(server, setting, fallback) {
    return rateLimit({
        windowMs: WINDOW_MS,
        limit: async () => {
            const value = Number(await server.db.models['setting'].get(setting));
            return Number.isInteger(value) && value > 0 ? value : fallback;
        },
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        identifier: setting,
        keyGenerator: (req) => `api_user:${req.apiUserId}`,
        handler: (req, res) => {
            res.status(429).json({message: 'errors.rest.rateLimitExceeded'});
        },
    });
}

/**
 * Budget for every REST request. Mounted once for all of /rest/v1.
 */
function createRestRateLimit(server) {
    return createLimiter(server, GENERAL_SETTING, GENERAL_DEFAULT);
}

const heavyLimiters = new WeakMap();

/**
 * Smaller budget for expensive routes (uploads, bulk writes, imports, copies). A route that is
 * expensive adds heavyRateLimit(server) to its own definition, so the marking sits on the route.
 * All routes of one server share one counter.
 */
function heavyRateLimit(server) {
    if (!heavyLimiters.has(server)) {
        heavyLimiters.set(server, createLimiter(server, HEAVY_SETTING, HEAVY_DEFAULT));
    }
    return heavyLimiters.get(server);
}

module.exports = {
    createRestRateLimit,
    heavyRateLimit,
    GENERAL_SETTING,
    HEAVY_SETTING,
    GENERAL_DEFAULT,
    HEAVY_DEFAULT,
};
