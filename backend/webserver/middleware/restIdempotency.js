'use strict';

const crypto = require('crypto');
const {Op} = require('sequelize');

const KEEP_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

// The token is part of the request: another token of the same user reusing a key gets 422, never
// this token's stored answer (which it might not have the rights to produce).
function requestHash(req) {
    return crypto.createHash('sha256')
        .update(JSON.stringify({token: req.apiToken?.id ?? null, body: req.body || {}}))
        .digest('hex');
}

/**
 * Optional Idempotency-Key for POST requests under /rest/v1.
 *
 * The first request with a key runs normally; a successful (2xx) answer is stored for 24 hours.
 * A repeat with the same key, route, and JSON body gets the stored answer with the header
 * Idempotent-Replayed: true, and nothing runs again. A key reused for another route, another
 * body, or by another token is 422. A repeat while the first is still running is 409. A failed first request stores
 * nothing, so it can be retried with the same key. Multipart bodies (uploads) are compared by
 * route only, because the file is read later by the route.
 *
 * Mounted after Bearer auth, so req.apiUserId is set.
 */
function createRestIdempotency(server) {
    const model = () => server.db.models['api_idempotency_key'];

    return async function restIdempotency(req, res, next) {
        const key = req.get('Idempotency-Key');
        if (req.method !== 'POST' || key === undefined) {
            return next();
        }
        if (!KEY_PATTERN.test(key)) {
            return res.status(400).json({message: 'errors.rest.invalidIdempotencyKey'});
        }
        try {
            const path = req.baseUrl + req.path;
            const hash = requestHash(req);
            // Expired rows are a cache, not user data: removing them for good is intended. Everyone's
            // expired rows go, so rows of users who stopped sending keys do not stay forever.
            await model().destroy({where: {createdAt: {[Op.lt]: new Date(Date.now() - KEEP_MS)}}});

            const existing = await model().findOne({
                where: {userId: req.apiUserId, idempotencyKey: key},
                raw: true,
            });
            if (existing) {
                if (existing.method !== req.method || existing.path !== path || existing.requestHash !== hash) {
                    return res.status(422).json({message: 'errors.rest.idempotencyKeyReused'});
                }
                if (existing.statusCode == null) {
                    return res.status(409).json({message: 'errors.rest.idempotencyKeyInProgress'});
                }
                res.set('Idempotent-Replayed', 'true');
                return res.status(existing.statusCode).json(existing.responseBody);
            }

            let row;
            try {
                row = await model().create({
                    userId: req.apiUserId,
                    idempotencyKey: key,
                    method: req.method,
                    path,
                    requestHash: hash,
                    deleted: false,
                });
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    return res.status(409).json({message: 'errors.rest.idempotencyKeyInProgress'});
                }
                throw err;
            }

            let settled = false;
            const forget = () => model().destroy({where: {id: row.id}})
                .catch((err) => server.logger.error('Idempotency key cleanup failed: ' + err));
            const json = res.json.bind(res);
            res.json = (body) => {
                settled = true;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    model().update({statusCode: res.statusCode, responseBody: body}, {where: {id: row.id}})
                        .catch((err) => {
                            server.logger.error('Idempotency key store failed: ' + err);
                            return forget();
                        });
                } else {
                    forget();
                }
                return json(body);
            };
            // An answer that never went through res.json (connection closed, upload aborted) stores nothing.
            res.on('close', () => {
                if (!settled) {
                    forget();
                }
            });
            return next();
        } catch (err) {
            server.logger.error('Idempotency check failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    };
}

module.exports = {createRestIdempotency};
