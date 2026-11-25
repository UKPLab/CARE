'use strict';

/**
 * Shared shape of the REST route handlers: options for the REST functions, one transaction per
 * write, the Idempotency-Key check, known errors mapped to 400/403/404, anything else logged and
 * answered 500, and the upload middleware.
 */

const fileUpload = require('express-fileupload');
const {startRestTransaction} = require('../../utils/restBroadcast');
const {tokenCan} = require('../../middleware/bearerAuth');
const {sendKnownError, errorKey} = require('../../utils/restHelpers');
const {
    answerFromKey, answerFromRow, reserveKeyInTransaction, storeAnswerInTransaction, reserveKeyWithLease, finishLease,
} = require('../../middleware/restIdempotency');

// Same total cap as the socket upload (maxHttpBufferSize in Server.js), for the whole request.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
// Upload routes read a handful of short form fields (ids, name, description, type).
const MAX_UPLOAD_FIELDS = 20;
const MAX_UPLOAD_FIELD_BYTES = 100 * 1024;

/**
 * Multipart upload middleware for REST routes. A request over 100 MB in total is refused before
 * anything is read; a multipart request without Content-Length (chunked) is refused too, because
 * its size cannot be checked first. Busboy then caps each file, the number of files, and the number
 * and size of form fields. File names are read as UTF-8, so names like "Übersicht.pdf" are stored
 * as sent.
 *
 * @param {number} maxFiles how many files one request may carry
 * @returns {Array<Function>} middleware to put in the route definition
 */
function uploadFiles(maxFiles) {
    const tooLarge = (res) => res.status(413).json({message: 'errors.rest.fileTooLarge'});
    return [
        (req, res, next) => {
            const length = req.headers['content-length'];
            if (length === undefined && req.is('multipart/form-data')) {
                return res.status(411).json({message: 'errors.rest.contentLengthRequired'});
            }
            return Number(length) > MAX_UPLOAD_BYTES ? tooLarge(res) : next();
        },
        fileUpload({
            limits: {
                fileSize: MAX_UPLOAD_BYTES,
                files: maxFiles,
                fields: MAX_UPLOAD_FIELDS,
                fieldSize: MAX_UPLOAD_FIELD_BYTES,
                parts: maxFiles + MAX_UPLOAD_FIELDS,
            },
            abortOnLimit: true,
            limitHandler: (req, res) => tooLarge(res),
            defParamCharset: 'utf8',
        }),
    ];
}

/**
 * The options object the REST functions receive: transaction, models, server, logger, and can
 * (checks a right of the token).
 *
 * @param {Server} server main server instance
 * @param {Object} req express request (after Bearer auth)
 * @param {Object} [transaction] the write's transaction; none for reads
 * @param {Object} [extra] more options, e.g. writtenFiles
 * @returns {Object} the REST options
 */
function restOptions(server, req, transaction, extra = {}) {
    return {
        transaction,
        models: server.db.models,
        server,
        logger: server.logger,
        can: tokenCan(server, req),
        ...extra,
    };
}

/**
 * A path id: "12" is an id, anything else is not.
 *
 * @param {*} raw the path parameter
 * @returns {number|null} the id, or null when it is not one
 */
function readId(raw) {
    return /^\d+$/.test(String(raw)) ? Number(raw) : null;
}

/**
 * Answer an error the way every REST route does: a known key with its status, otherwise 500.
 *
 * @param {Server} server main server instance
 * @param {Object} res express response
 * @param {Object} spec the route spec (label, errors)
 * @param {Error} err the error
 * @returns {Object|undefined} the response
 */
function answerError(server, res, spec, err) {
    if (sendKnownError(res, err, spec.errors)) {
        return undefined;
    }
    server.logger.error(`REST ${spec.label} failed: ` + err);
    return res.status(500).json({message: 'errors.server.unknownError'});
}

/**
 * Run a write in one transaction. `work(options)` returns the response body, or null for 404.
 *
 * With an Idempotency-Key, a known key is answered first (after the route's right checks); otherwise
 * the key is reserved inside the same transaction and the answer is stored there too, so a crash or
 * a failure leaves nothing behind and a committed write always has its answer.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @param {Object} res express response
 * @param {Object} spec the route spec
 * @param {string} spec.label the action name for the log
 * @param {number} [spec.status] the success status, 200 by default
 * @param {string} [spec.notFound] the error key for a 404
 * @param {Object} [spec.errors] the error map for sendKnownError
 * @param {string[]} [spec.writtenFiles] collects the files the write creates
 * @param {Function} [spec.onRollback] runs after a rollback
 * @param {Function} [spec.dryRun] receives the body; true rolls back and answers 200
 * @param {Function} work receives the options, returns the body
 * @returns {Promise<Object|undefined>} the response
 */
async function runWrite(server, req, res, spec, work) {
    if (req.idempotencyKey && await answerFromKey(server, req, res)) {
        return undefined;
    }
    const transaction = await startRestTransaction(server, req.apiUserId);
    const options = restOptions(server, req, transaction, spec.writtenFiles ? {writtenFiles: spec.writtenFiles} : {});
    try {
        let keyRowId = null;
        if (req.idempotencyKey) {
            keyRowId = await reserveKeyInTransaction(server, req, transaction);
            if (keyRowId === null) {
                // Another request with this key committed meanwhile: answer from it.
                await transaction.rollback();
                if (!(await answerFromKey(server, req, res))) {
                    res.status(409).json({message: 'errors.rest.idempotencyKeyInProgress'});
                }
                return undefined;
            }
        }
        const body = await work(options);
        if (body === null) {
            await transaction.rollback();
            spec.onRollback?.();
            return res.status(404).json({message: spec.notFound});
        }
        if (spec.dryRun?.(body)) {
            await transaction.rollback();
            spec.onRollback?.();
            return res.status(200).json(body);
        }
        const status = spec.status || 200;
        if (keyRowId !== null) {
            await storeAnswerInTransaction(server, keyRowId, status, body, transaction);
        }
        await transaction.commit();
        return res.status(status).json(body);
    } catch (err) {
        // COMMIT succeeded but a step after it failed (startRestTransaction sets restCommitted):
        // the data is saved, so keep written files and say so with 500. A failed COMMIT itself
        // leaves restCommitted unset and is cleaned up like any other failure below.
        if (transaction.restCommitted) {
            server.logger.error(`REST ${spec.label} failed after commit: ` + err);
            const key = errorKey(err);
            return res.status(500).json(key
                ? {message: key, ...(err.params ? {params: err.params} : {})}
                : {message: 'errors.server.unknownError'});
        }
        try {
            await transaction.rollback();
        } catch (_rollbackError) {
            // already rolled back
        }
        spec.onRollback?.();
        return answerError(server, res, spec, err);
    }
}

/**
 * Run a read, or a write that manages its own transactions (the bulk study routes). `work(options)`
 * returns the response body, or null for 404. A keyed POST here uses a lease: see restIdempotency.
 *
 * @param {Server} server main server instance
 * @param {Object} req express request
 * @param {Object} res express response
 * @param {Object} spec the route spec
 * @param {string} spec.label the action name for the log
 * @param {string} [spec.notFound] the error key for a 404
 * @param {Object} [spec.errors] the error map for sendKnownError
 * @param {Function} work receives the options, returns the body
 * @returns {Promise<Object|undefined>} the response
 */
async function runRead(server, req, res, spec, work) {
    let leaseRowId = null;
    if (req.idempotencyKey) {
        const lease = await reserveKeyWithLease(server, req);
        if (lease.rowId === undefined) {
            return answerFromRow(res, lease.row, lease.state);
        }
        leaseRowId = lease.rowId;
    }
    try {
        const body = await work(restOptions(server, req));
        if (body === null) {
            if (leaseRowId !== null) {
                await finishLease(server, leaseRowId, null);
            }
            return res.status(404).json({message: spec.notFound});
        }
        if (leaseRowId !== null) {
            await finishLease(server, leaseRowId, 200, body);
        }
        return res.status(200).json(body);
    } catch (err) {
        if (leaseRowId !== null) {
            await finishLease(server, leaseRowId, null).catch((cleanupError) =>
                server.logger.error('Idempotency lease cleanup failed: ' + cleanupError));
        }
        return answerError(server, res, spec, err);
    }
}

/**
 * Copy the allowed keys from a body after checking each value's type.
 *
 * @param {Object} body request body
 * @param {Object} rules key to its check function (see `is`)
 * @returns {Object} {fields}, or {error: true} when a value fails its check
 */
function readFields(body, rules) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {fields: {}};
    }
    const fields = {};
    for (const [key, check] of Object.entries(rules)) {
        if (body[key] === undefined) {
            continue;
        }
        if (!check(body[key])) {
            return {error: true};
        }
        fields[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
    return {fields};
}

/** Type checks for readFields: each takes a value and returns whether it fits. */
const is = {
    text: (value) => typeof value === 'string' && value.trim() !== '',
    textOrEmpty: (value) => typeof value === 'string',
    textOrNull: (value) => value === null || typeof value === 'string',
    bool: (value) => typeof value === 'boolean',
    id: (value) => Number.isInteger(value) && value > 0,
    idOrNull: (value) => value === null || (Number.isInteger(value) && value > 0),
    dateOrNull: (value) => value === null || (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())),
    object: (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
};

module.exports = {restOptions, readId, runWrite, runRead, readFields, is, uploadFiles, MAX_UPLOAD_BYTES};
