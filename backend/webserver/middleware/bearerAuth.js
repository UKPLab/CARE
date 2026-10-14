'use strict';

const {
    hashSecret,
    isApiTokensEnabled,
    hasOnlyGuestRole,
    tokenHasRight,
} = require('../utils/apiTokenAuth');

/**
 * Resolve Authorization: Bearer <secret> to the token owner. Does not call req.logIn.
 */
function createBearerAuthMiddleware(server) {
    return async function bearerAuth(req, res, next) {
        try {
            const enabled = isApiTokensEnabled(
                await server.db.models['setting'].get('system.auth.apiTokens.enabled')
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
            if (await hasOnlyGuestRole(server.db.models, token.userId)) {
                return res.status(403).json({message: 'errors.rest.guestCannotUseToken'});
            }

            req.apiToken = token;
            req.apiUserId = token.userId;
            server.db.models['api_token'].updateById(token.id, {lastUsedAt: new Date()}).catch((err) => {
                server.logger.error('Failed to update api_token lastUsedAt: ' + err);
            });
            return next();
        } catch (err) {
            server.logger.error('Bearer auth failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    };
}

function requireTokenRight(server, right) {
    return async function (req, res, next) {
        try {
            const allowed = await tokenHasRight(server.db.models, req.apiToken, right);
            if (!allowed) {
                return res.status(403).json({message: 'errors.rest.missingTokenRight'});
            }
            return next();
        } catch (err) {
            server.logger.error('Token right check failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    };
}

module.exports = {
    createBearerAuthMiddleware,
    requireTokenRight,
};
