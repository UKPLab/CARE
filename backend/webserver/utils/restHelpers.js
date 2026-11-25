'use strict';

/**
 * Small helpers shared by the /rest/v1 routes (routes/rest/) and the REST functions (rest/).
 * Socket classes do not use them.
 */

const {Op} = require('sequelize');

const denyAll = async () => false;

/**
 * The right check a REST route passes as `options.can`: true when the right is on the token and
 * its owner still has it. Without a checker every right is denied.
 *
 * @param {Object} [options] the REST options
 * @returns {Function} takes a right name, resolves to a boolean
 */
function canOf(options) {
    return options && typeof options.can === 'function' ? options.can : denyAll;
}

/**
 * "12" is an id, anything else is a hash.
 *
 * @param {string|number} idOrHash the id or hash from the path
 * @returns {Object} {identifierType: 'id' or 'hash', identifier}
 */
function parseIdOrHash(idOrHash) {
    const raw = String(idOrHash);
    if (/^\d+$/.test(raw)) {
        return {identifierType: 'id', identifier: Number(raw)};
    }
    return {identifierType: 'hash', identifier: raw};
}

/**
 * Load a row of a model with a hash column by id or by hash.
 *
 * @param {Object} model a MetaModel
 * @param {string|number} idOrHash the id or hash from the path
 * @returns {Promise<Object|undefined>} the row, or undefined when it does not exist
 */
async function loadByIdOrHash(model, idOrHash) {
    const {identifierType, identifier} = parseIdOrHash(idOrHash);
    return identifierType === 'hash' ? model.getByHash(identifier) : model.getById(identifier);
}

/**
 * Keep only the listed keys of a row, so a new database column is not sent out by accident.
 *
 * @param {Object|null} row the row or model instance
 * @param {string[]} fields the keys to keep
 * @returns {Object|null} the picked fields, or the row itself when it is empty
 */
function pickFields(row, fields) {
    if (!row) {
        return row;
    }
    const plain = typeof row.get === 'function' ? row.get({plain: true}) : row;
    return Object.fromEntries(fields.map((key) => [key, plain[key] ?? null]));
}

/**
 * The i18n key a thrown error carries, or null for an unexpected error.
 *
 * @param {Error} err the error
 * @returns {string|null} the key
 */
function errorKey(err) {
    if (!err) {
        return null;
    }
    if (typeof err.key === 'string') {
        return err.key;
    }
    if (typeof err.message === 'string' && err.message.startsWith('errors.')) {
        return err.message;
    }
    return null;
}

/**
 * Answer a known error: 404 for keys in notFound, 403 for keys in forbidden, 400 for any other key.
 * `rename` maps a socket error key to the REST key the docs promise.
 *
 * @param {Object} res express response
 * @param {Error} err the error
 * @param {Object} [map] the error map
 * @param {Set<string>} [map.notFound] keys answered with 404
 * @param {Set<string>} [map.forbidden] keys answered with 403
 * @param {Object} [map.rename] socket error key to REST error key
 * @returns {boolean} false when the error has no key, so the caller answers 500
 */
function sendKnownError(res, err, map = {}) {
    let key = errorKey(err);
    if (!key) {
        return false;
    }
    key = (map.rename && map.rename[key]) || key;
    const status = map.notFound?.has(key) ? 404 : map.forbidden?.has(key) ? 403 : 400;
    res.status(status).json(err.params ? {message: key, params: err.params} : {message: key});
    return true;
}

/**
 * A where clause that leaves out deleted rows, so no REST query can forget it. Rows whose deleted
 * flag is null count as not deleted.
 *
 * @param {Object} [where] the conditions
 * @returns {Object} the conditions plus "not deleted"
 */
function notDeleted(where = {}) {
    return {...where, deleted: {[Op.not]: true}};
}

/**
 * Rows of a model that are not deleted, for REST queries the MetaModel helpers cannot express:
 * several conditions at once, OR, or a limit. A query on one column uses the model's getAllByKey
 * or getAllByKeyValues instead.
 *
 * @param {Object} model a MetaModel
 * @param {Object} where the conditions; "not deleted" is added
 * @param {Object} [options] more Sequelize options (transaction, attributes, order, limit, raw)
 * @returns {Promise<Array<Object>>} the rows, plain objects unless options.raw is false
 */
function findActive(model, where, options = {}) {
    return model.findAll({raw: true, ...options, where: notDeleted(where)});
}

/**
 * The first row of a model that matches and is not deleted. See findActive.
 *
 * @param {Object} model a MetaModel
 * @param {Object} where the conditions; "not deleted" is added
 * @param {Object} [options] more Sequelize options (transaction, attributes, order, raw)
 * @returns {Promise<Object|null>} the row, or null
 */
function findOneActive(model, where, options = {}) {
    return model.findOne({raw: true, ...options, where: notDeleted(where)});
}

/**
 * How many rows of a model match and are not deleted. See findActive.
 *
 * @param {Object} model a MetaModel
 * @param {Object} where the conditions; "not deleted" is added
 * @param {Object} [options] more Sequelize options (transaction)
 * @returns {Promise<number>} the count
 */
function countActive(model, where, options = {}) {
    return model.count({...options, where: notDeleted(where)});
}

module.exports = {
    canOf, parseIdOrHash, loadByIdOrHash, pickFields, errorKey, sendKnownError,
    notDeleted, findActive, findOneActive, countActive,
};
