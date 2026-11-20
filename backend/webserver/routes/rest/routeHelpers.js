'use strict';

const fileUpload = require('express-fileupload');
const {startRestTransaction} = require('../../utils/restBroadcast');
const {tokenCan} = require('../../middleware/bearerAuth');
const {sendKnownError, errorKey} = require('../../utils/restHelpers');

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
 * @param {number} maxFiles how many files one request may carry
 * @returns {Function[]} middleware to put in the route definition
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
        // An Idempotency-Key on an upload is checked now that the files are read (restIdempotency).
        (req, res, next) => {
            req.uploadParsed = true;
            return req.idempotencyCheck ? req.idempotencyCheck(req, res, next) : next();
        },
    ];
}

/**
 * Shared shape of the newer REST route handlers: options for the REST functions, one transaction
 * per write, known errors mapped to 400/403/404, anything else logged and answered 500.
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

/** "12" is an id; anything else is not. */
function readId(raw) {
    return /^\d+$/.test(String(raw)) ? Number(raw) : null;
}

/**
 * True (and answered 415) when an Idempotency-Key came with a multipart body to a route that takes
 * no upload: restIdempotency postponed the key check for the upload middleware, which this route
 * does not have, so running it would ignore the key.
 */
function refuseUncheckedMultipart(req, res) {
    if (req.idempotencyCheck && !req.uploadParsed) {
        res.status(415).json({message: 'errors.rest.multipartNotAccepted'});
        return true;
    }
    return false;
}

/**
 * Run a write in one transaction. `work(options)` returns the response body, or null for 404.
 * @param {Object} spec {status, label, notFound: key, errors: map for sendKnownError, writtenFiles,
 *     onRollback, dryRun: body => true to roll back and answer 200}
 */
async function runWrite(server, req, res, spec, work) {
    if (refuseUncheckedMultipart(req, res)) {
        return;
    }
    const transaction = await startRestTransaction(server, req.apiUserId);
    const options = restOptions(server, req, transaction, spec.writtenFiles ? {writtenFiles: spec.writtenFiles} : {});
    try {
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
        // With an Idempotency-Key, the answer is stored in the same transaction as the write, so a
        // committed write always has its stored answer, even if the process stops right after.
        if (req.idempotencyRowId) {
            await server.db.models['api_idempotency_key'].update(
                {statusCode: status, responseBody: body},
                {where: {id: req.idempotencyRowId}, transaction}
            );
        }
        await transaction.commit();
        req.idempotencyStored = Boolean(req.idempotencyRowId);
        return res.status(status).json(body);
    } catch (err) {
        // COMMIT succeeded but a step after it failed (startRestTransaction sets restCommitted):
        // the data is saved, so keep written files and say so with 500. A failed COMMIT itself
        // leaves restCommitted unset and is cleaned up like any other failure below.
        if (transaction.restCommitted) {
            req.idempotencyStored = Boolean(req.idempotencyRowId);
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
        if (sendKnownError(res, err, spec.errors)) {
            return;
        }
        server.logger.error(`REST ${spec.label} failed: ` + err);
        return res.status(500).json({message: 'errors.server.unknownError'});
    }
}

/**
 * Run a read. `work(options)` returns the response body, or null for 404.
 */
async function runRead(server, req, res, spec, work) {
    if (refuseUncheckedMultipart(req, res)) {
        return;
    }
    try {
        const body = await work(restOptions(server, req));
        if (body === null) {
            return res.status(404).json({message: spec.notFound});
        }
        return res.status(200).json(body);
    } catch (err) {
        if (sendKnownError(res, err, spec.errors)) {
            return;
        }
        server.logger.error(`REST ${spec.label} failed: ` + err);
        return res.status(500).json({message: 'errors.server.unknownError'});
    }
}

/**
 * Copy the allowed keys from a body after checking each value's type.
 * @param {Object} body request body
 * @param {Object<string, function(*): boolean>} rules key to check
 * @returns {{fields: Object}|{error: true}}
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
