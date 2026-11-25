'use strict';

const {
    hashSecret,
    isApiTokensEnabled,
    loadTokenAccess,
} = require('../utils/apiTokenAuth');

// How often lastUsedAt is written for one token.
const LAST_USED_EVERY_MS = 60 * 1000;

/**
 * Resolve Authorization: Bearer <secret> to the token owner. Does not call req.logIn.
 * Sets req.apiToken, req.apiAccess (the rights this request may use), and req.apiUserId.
 *
 * @param {Server} server main server instance
 * @returns {Function} express middleware
 */
function createBearerAuthMiddleware(server) {
    return async function bearerAuth(req, res, next) {
        try {
            // Read on every request, so a short-lived copy is used (cleared when a setting is saved).
            const enabled = isApiTokensEnabled(
                await server.db.models['setting'].getCached('system.auth.apiTokens.enabled')
            );
            if (!enabled) {
                return res.status(403).json({message: 'errors.rest.apiTokensDisabled'});
            }

            const header = req.headers.authorization;
            if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
                return res.status(401).json({message: 'errors.rest.missingBearer'});
            }
            const secret = header.slice('Bearer '.length).trim();
            if (!secret) {
                return res.status(401).json({message: 'errors.rest.missingBearer'});
            }

            const token = await server.db.models['api_token'].findOne({
                where: {
                    keyHash: hashSecret(secret),
                    deleted: false,
                },
                raw: true,
            });
            if (!token) {
                return res.status(401).json({message: 'errors.rest.invalidBearer'});
            }
            if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
                return res.status(401).json({message: 'errors.rest.expiredBearer'});
            }
            const access = await loadTokenAccess(server.db.models, token);
            if (!access) {
                return res.status(401).json({message: 'errors.rest.tokenOwnerDeleted'});
            }
            if (access.guestOnly) {
                return res.status(403).json({message: 'errors.rest.guestCannotUseToken'});
            }

            req.apiToken = token;
            // The rights this request may use: on the token and still held by the owner.
            req.apiAccess = access;
            req.apiUserId = token.userId;
            // At most once a minute per token, so a busy script does not write on every request.
            if (!token.lastUsedAt || Date.now() - new Date(token.lastUsedAt).getTime() >= LAST_USED_EVERY_MS) {
                server.db.models['api_token'].updateById(token.id, {lastUsedAt: new Date()}).catch((err) => {
                    server.logger.error('Failed to update api_token lastUsedAt: ' + err);
                });
            }
            return next();
        } catch (err) {
            server.logger.error('Bearer auth failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    };
}

/**
 * True when the token behind this request may use the right (loaded once by bearerAuth).
 *
 * @param {Object} req express request, after Bearer auth
 * @param {string} right the right name
 * @returns {boolean}
 */
function requestHasRight(req, right) {
    return Boolean(req.apiAccess && req.apiAccess.rights.has(right));
}

/**
 * Pass only when the token has the right (and its owner still has it); otherwise answer 403.
 *
 * @param {Server} server main server instance
 * @param {string} right the right name
 * @returns {Function} express middleware
 */
function requireTokenRight(server, right) {
    return function (req, res, next) {
        if (!requestHasRight(req, right)) {
            return res.status(403).json({message: 'errors.rest.missingTokenRight'});
        }
        return next();
    };
}

/**
 * Pass when the token has at least one of the rights (and its owner still has it); otherwise answer 403.
 *
 * @param {Server} server main server instance
 * @param {string[]} rights the right names
 * @returns {Function} express middleware
 */
function requireAnyTokenRight(server, rights) {
    return function (req, res, next) {
        if (!rights.some((right) => requestHasRight(req, right))) {
            return res.status(403).json({message: 'errors.rest.missingTokenRight'});
        }
        return next();
    };
}

/**
 * The right check REST functions receive as `options.can`. True only when the right is on the
 * token and the owner still has it. Being an admin gives a token no reach by itself.
 * Kept async so REST functions can await it like the socket checks.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request, after Bearer auth
 * @returns {Function} takes a right name, resolves to a boolean
 */
function tokenCan(server, req) {
    return async (right) => requestHasRight(req, right);
}

module.exports = {
    requestHasRight,
    createBearerAuthMiddleware,
    requireTokenRight,
    requireAnyTokenRight,
    tokenCan,
};
