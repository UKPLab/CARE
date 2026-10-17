'use strict';

const {rateLimit, ipKeyGenerator} = require('express-rate-limit');

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 100;

/**
 * Per-token budget after Bearer lookup, per hour. 100 is a placeholder until the real budget is chosen.
 */
function createRestTokenRateLimit() {
    return rateLimit({
        windowMs: WINDOW_MS,
        limit: LIMIT,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        keyGenerator: (req) => {
            if (req.apiToken && req.apiToken.id) {
                return `api_token:${req.apiToken.id}`;
            }
            return ipKeyGenerator(req.ip);
        },
        handler: (req, res) => {
            res.status(429).json({message: 'errors.rest.rateLimitExceeded'});
        },
    });
}

module.exports = {
    createRestTokenRateLimit,
    REST_RATE_LIMIT: LIMIT,
    REST_RATE_WINDOW_MS: WINDOW_MS,
};
