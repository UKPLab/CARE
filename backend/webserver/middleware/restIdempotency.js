'use strict';

const crypto = require('crypto');
const {Op} = require('sequelize');

const KEEP_MS = 24 * 60 * 60 * 1000;
// Expired rows are removed at most this often, not on every keyed request.
const CLEANUP_EVERY_MS = 60 * 1000;
// Bulk study routes commit study by study, so their key cannot live inside one transaction. A key
// of theirs still "in progress" after this long belongs to a request that died, and a retry may
// take it over. Repeating a bulk open, close, or delete is safe: studies already done are skipped.
const LEASE_MS = 10 * 60 * 1000;
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

/**
 * Uploaded files as {field, name, md5}, so another file under the same key is another request.
 *
 * @param {Object} req express request, after the upload middleware
 * @returns {Array<Object>} one {field, name, md5} per file, sorted
 */
function uploadedFiles(req) {
    return Object.entries(req.files || {})
        .flatMap(([field, value]) => (Array.isArray(value) ? value : [value])
            .map((file) => ({field, name: file.name, md5: file.md5})))
        .sort((a, b) => (a.field + a.name + a.md5).localeCompare(b.field + b.name + b.md5));
}

/**
 * Fingerprint of a request: the token, the body, and any uploaded files. Another token of the same
 * user reusing a key gets 422, never this token's stored answer.
 *
 * @param {Object} req express request
 * @returns {string} the sha256 hex hash
 */
function requestHash(req) {
    return crypto.createHash('sha256')
        .update(JSON.stringify({token: req.apiToken?.id ?? null, body: req.body || {}, files: uploadedFiles(req)}))
        .digest('hex');
}

/**
 * The key's row for this user, or null.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @returns {Promise<Object|null>} the api_idempotency_key row
 */
function findKey(server, req) {
    return server.db.models['api_idempotency_key'].findOne({
        where: {userId: req.apiUserId, idempotencyKey: req.idempotencyKey},
        raw: true,
    });
}

/**
 * What an existing row means for this request: another request ("reused"), a stored answer
 * ("stored"), or still running ("running").
 *
 * @param {Object} row the api_idempotency_key row
 * @param {Object} req express request
 * @returns {string} 'reused', 'stored', or 'running'
 */
function rowState(row, req) {
    if (row.method !== req.method || row.path !== req.baseUrl + req.path || row.requestHash !== requestHash(req)) {
        return 'reused';
    }
    return row.statusCode == null ? 'running' : 'stored';
}

/**
 * Answer from an existing row: 422 for another request, the stored answer, or 409 while running.
 *
 * @param {Object} res express response
 * @param {Object} row the api_idempotency_key row
 * @param {string} state 'reused', 'stored', or 'running'
 * @returns {Object} the response
 */
function answerFromRow(res, row, state) {
    if (state === 'reused') {
        return res.status(422).json({message: 'errors.rest.idempotencyKeyReused'});
    }
    if (state === 'running') {
        return res.status(409).json({message: 'errors.rest.idempotencyKeyInProgress'});
    }
    res.set('Idempotent-Replayed', 'true');
    return res.status(row.statusCode).json(row.responseBody);
}

/**
 * Before a keyed write runs: answer from the key if it is already known. Called by runWrite after
 * the route's own right checks, so a token that lost its right gets 403, not a stored answer.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @param {Object} res express response
 * @returns {Promise<boolean>} true when the request was answered
 */
async function answerFromKey(server, req, res) {
    const row = await findKey(server, req);
    if (!row) {
        return false;
    }
    answerFromRow(res, row, rowState(row, req));
    return true;
}

/**
 * Reserve the key inside the write's own transaction. A crash or a failure rolls the reservation
 * back with the write, so nothing is left stuck. A second request with the same key waits on the
 * database until the first commits (it then finds the stored answer) or rolls back (it then runs).
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @param {Object} [transaction] the write's transaction
 * @returns {Promise<number|null>} the row id, or null when another request holds the key
 */
async function reserveKeyInTransaction(server, req, transaction) {
    try {
        const row = await server.db.models['api_idempotency_key'].create({
            userId: req.apiUserId,
            idempotencyKey: req.idempotencyKey,
            method: req.method,
            path: req.baseUrl + req.path,
            requestHash: requestHash(req),
            deleted: false,
        }, {transaction});
        return row.id;
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return null;
        }
        throw err;
    }
}

/**
 * Store the answer in the same transaction as the write, so a committed write always has it.
 *
 * @param {Server} server main server instance
 * @param {number} rowId the api_idempotency_key row id
 * @param {number} statusCode the answer's status
 * @param {Object} body the answer's body
 * @param {Object} transaction the write's transaction
 * @returns {Promise<void>}
 * @throws {Error} when the row is gone, so the write is rolled back instead of saved without its answer
 */
async function storeAnswerInTransaction(server, rowId, statusCode, body, transaction) {
    const [updated] = await server.db.models['api_idempotency_key'].update(
        {statusCode, responseBody: body},
        {where: {id: rowId}, transaction}
    );
    if (updated !== 1) {
        throw new Error('Idempotency key row ' + rowId + ' disappeared before the answer was stored');
    }
}

/**
 * For the bulk study routes (several transactions): reserve the key with a lease. A key of a dead
 * request (still running after LEASE_MS) is taken over; only one retry can win that race.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @returns {Promise<Object>} {rowId} for a reservation, or {row, state} to answer from
 */
async function reserveKeyWithLease(server, req) {
    const model = server.db.models['api_idempotency_key'];
    const existing = await findKey(server, req);
    if (existing) {
        const state = rowState(existing, req);
        if (state !== 'running') {
            return {row: existing, state};
        }
        const [taken] = await model.update({statusCode: null}, {
            where: {id: existing.id, statusCode: null, updatedAt: {[Op.lt]: new Date(Date.now() - LEASE_MS)}},
        });
        return taken === 1 ? {rowId: existing.id} : {row: existing, state};
    }
    const rowId = await reserveKeyInTransaction(server, req, undefined);
    if (rowId !== null) {
        return {rowId};
    }
    const row = await findKey(server, req);
    return {row, state: rowState(row, req)};
}

/**
 * End a lease: store a successful answer, or remove the key after a failure so a retry runs.
 *
 * @param {Server} server main server instance
 * @param {number} rowId the api_idempotency_key row id
 * @param {number|null} statusCode a 2xx code, or null after a failure
 * @param {Object} [body] the answer's body
 * @returns {Promise<void>}
 */
async function finishLease(server, rowId, statusCode, body) {
    const model = server.db.models['api_idempotency_key'];
    if (statusCode === null) {
        await model.destroy({where: {id: rowId}});
        return;
    }
    const [updated] = await model.update({statusCode, responseBody: body}, {where: {id: rowId}});
    if (updated !== 1) {
        // Leave nothing to replay; the lease runs out and a retry repeats the (safe) bulk action.
        server.logger.error('Idempotency key row ' + rowId + ' disappeared before the answer was stored');
    }
}

/**
 * Optional Idempotency-Key for POST requests under /rest/v1.
 *
 * This middleware only checks the header and remembers the key (req.idempotencyKey). The check
 * itself runs in runWrite and runRead (routes/rest/routeHelpers.js), after the route's right checks
 * and after an upload has been read:
 * - a repeat with the same key, route, body, and files gets the stored answer with the header
 *   Idempotent-Replayed: true, and nothing runs again;
 * - the same key for another route, body, or file, or from another token, is 422;
 * - a second request while the first is still running waits for it and then gets its answer
 *   (bulk study routes answer 409 instead, until their 10-minute lease runs out);
 * - a failed request stores nothing, so it can be retried with the same key.
 * Answers are kept for 24 hours. Mounted after Bearer auth, so req.apiUserId is set.
 *
 * @param {Server} server main server instance
 * @returns {Function} express middleware
 */
function createRestIdempotency(server) {
    /**
     * Remove expired keys of all users, at most once per CLEANUP_EVERY_MS.
     *
     * @returns {Promise<void>}
     */
    async function removeExpired() {
        const now = Date.now();
        if (now - (server.restIdempotencyCleanedAt || 0) < CLEANUP_EVERY_MS) {
            return;
        }
        server.restIdempotencyCleanedAt = now;
        // Expired rows are a cache, not user data: removing them for good is intended. Everyone's
        // expired rows go, so rows of users who stopped sending keys do not stay forever.
        await server.db.models['api_idempotency_key'].destroy({where: {createdAt: {[Op.lt]: new Date(now - KEEP_MS)}}});
    }

    return async function restIdempotency(req, res, next) {
        const key = req.get('Idempotency-Key');
        if (req.method !== 'POST' || key === undefined) {
            return next();
        }
        if (!KEY_PATTERN.test(key)) {
            return res.status(400).json({message: 'errors.rest.invalidIdempotencyKey'});
        }
        try {
            await removeExpired();
        } catch (err) {
            server.logger.error('Idempotency cleanup failed: ' + err);
        }
        req.idempotencyKey = key;
        return next();
    };
}

module.exports = {
    createRestIdempotency,
    answerFromKey,
    answerFromRow,
    reserveKeyInTransaction,
    storeAnswerInTransaction,
    reserveKeyWithLease,
    finishLease,
    LEASE_MS,
};
