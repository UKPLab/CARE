'use strict';

const {translateMaybeKey} = require('../../utils/i18n');

/**
 * Body for a REST error: the i18n key in `message` (stable, for code), the English sentence in
 * `error` (for people reading the response), and `params` when the key has placeholders.
 * @param {string} key
 * @param {Object} [params]
 * @returns {{message: string, error: string, params?: Object}}
 */
function restErrorBody(key, params) {
    const body = {message: key, error: translateMaybeKey(key, params || {})};
    if (params) {
        body.params = params;
    }
    return body;
}

/**
 * Add the English sentence to every REST error answered with {message: "errors..."}.
 * Routes keep sending the key only; this fills in `error` in one place.
 */
function restErrorText(req, res, next) {
    const json = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object' && !Array.isArray(body)
            && typeof body.message === 'string' && body.message.startsWith('errors.') && body.error === undefined) {
            return json({...body, ...restErrorBody(body.message, body.params)});
        }
        return json(body);
    };
    next();
}

/**
 * Express error handler for /rest/v1. The global JSON body parser runs before the REST routes,
 * so broken or oversized JSON would otherwise get Express' default HTML error page.
 */
// eslint-disable-next-line no-unused-vars
function restBodyErrors(err, req, res, next) {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json(restErrorBody('errors.rest.invalidJson'));
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json(restErrorBody('errors.rest.bodyTooLarge'));
    }
    return res.status(500).json(restErrorBody('errors.server.unknownError'));
}

module.exports = {restErrorText, restBodyErrors, restErrorBody};
