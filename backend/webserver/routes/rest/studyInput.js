'use strict';

/**
 * Reading and checking study request bodies for routes/rest/studies.js: study fields, step documents,
 * bulk ids, and import content, plus the error map and two loaders the study routes share.
 */

const TranslatableError = require('../../../utils/TranslatableError');
const {sendKnownError, errorKey} = require('../../utils/restHelpers');
const {is} = require('./routeHelpers');
const {AI_LIMIT_FIELDS, STUDY_FIELDS, loadStudyByIdOrHash, studyVisibleInList} = require('../../rest/studies');
const {parseStudyImport} = require('../../rest/studyTransfer');
const {stepDocumentsFromStudySteps} = require('../../sockets/study');

// Socket error keys mapped to the REST keys the docs promise.
const STUDY_ERRORS = {
    rename: {
        'errors.studies.studyNotFound': 'errors.rest.studyNotFound',
        'errors.studies.noPermissionCloseStudy': 'errors.rest.studyNoAccess',
        'errors.studies.noPermissionSaveAsTemplate': 'errors.rest.studyNoAccess',
        'errors.studies.noPermissionManageStudies': 'errors.rest.studyNoAccess',
        'errors.studies.notAllowedToSeeStudy': 'errors.rest.studyNoAccess',
        'errors.studies.studyAlreadyClosed': 'errors.rest.studyAlreadyClosed',
        'errors.studies.studyIdRequired': 'errors.rest.studyIdsRequired',
    },
    notFound: new Set(['errors.rest.studyNotFound', 'errors.rest.templateNotFound']),
    forbidden: new Set(['errors.rest.studyNoAccess', 'errors.rest.documentNoAccess']),
};

const BOOLEAN_FIELDS = new Set([
    'enableEmailNotifications',
    'collab',
    'anonymize',
    'resumable',
    'multipleSubmit',
]);
const INTEGER_FIELDS = new Set([
    'workflowId',
    'tagSetId',
    'timeLimit',
    'limitSessions',
    'limitSessionsPerUser',
]);
const DATE_FIELDS = new Set(['start', 'end']);
// Bulk open, close, and delete take at most this many ids per request.
const MAX_BULK_STUDY_IDS = 100;

/**
 * Answer a known study error with its REST key and status.
 *
 * @param {Object} res express response
 * @param {Error} err the error thrown by a study function
 * @returns {boolean} true when the error was known and answered
 */
function sendRestError(res, err) {
    return sendKnownError(res, err, STUDY_ERRORS);
}

/**
 * Load a study the caller may see in the study list.
 *
 * @param {number} userId the token owner's user id
 * @param {number|string} idOrHash the study id or hash from the path
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Object>} the study
 * @throws {TranslatableError} errors.rest.studyNotFound (404) or errors.rest.studyNoAccess (403)
 */
async function listedStudy(userId, idOrHash, options) {
    const study = await existingStudy(idOrHash, options);
    if (!(await studyVisibleInList(options.models, userId, study, options.can))) {
        throw new TranslatableError('errors.rest.studyNoAccess');
    }
    return study;
}

/**
 * Load a study by id or hash, without checking access.
 *
 * @param {number|string} idOrHash the study id or hash from the path
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object>} the study
 * @throws {TranslatableError} errors.rest.studyNotFound (404)
 */
async function existingStudy(idOrHash, options) {
    const study = await loadStudyByIdOrHash(options.models, idOrHash);
    if (!study) {
        throw new TranslatableError('errors.rest.studyNotFound');
    }
    return study;
}

/**
 * Read the study ids of a bulk open, close, or delete request.
 *
 * @param {Object} body request body with ids: a list of 1 to MAX_BULK_STUDY_IDS integers
 * @returns {Object} {ids}, or {error} with the error key to answer with 400
 */
function readStudyIds(body) {
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
        return {error: 'errors.rest.studyIdsRequired'};
    }
    if (body.ids.length > MAX_BULK_STUDY_IDS) {
        return {error: 'errors.rest.tooManyStudyIds'};
    }
    const ids = [];
    for (const raw of body.ids) {
        const id = Number(raw);
        if (!Number.isInteger(id)) {
            return {error: 'errors.rest.invalidStudyIds'};
        }
        ids.push(id);
    }
    return {ids};
}

/**
 * Read and type-check the study fields, AI cost limits, and step documents of a create or update.
 * Keys that are not study fields are ignored.
 *
 * @param {Object} body request body
 * @returns {Object} {fields, stepDocuments, aiLimits}, or {error} with the error key to answer with 400
 */
function readStudyFields(body) {
    const fields = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {fields};
    }
    for (const key of STUDY_FIELDS) {
        if (body[key] === undefined) {
            continue;
        }
        if (key === 'name' || key === 'description') {
            if (typeof body[key] !== 'string') {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = key === 'name' ? body[key].trim() : body[key];
            if (key === 'name' && !fields[key]) {
                return {error: 'errors.rest.studyNameRequired'};
            }
            continue;
        }
        if (BOOLEAN_FIELDS.has(key)) {
            if (typeof body[key] !== 'boolean') {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = body[key];
            continue;
        }
        if (INTEGER_FIELDS.has(key)) {
            if (body[key] === null) {
                fields[key] = null;
                continue;
            }
            const parsed = Number(body[key]);
            if (!Number.isInteger(parsed)) {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = parsed;
            continue;
        }
        if (DATE_FIELDS.has(key)) {
            if (!is.dateOrNull(body[key])) {
                return {error: 'errors.rest.invalidStudyField'};
            }
            fields[key] = body[key];
        }
    }
    // AI cost limits: a number of at least 0, or null; 0 and null mean no limit.
    const aiLimits = {};
    for (const key of AI_LIMIT_FIELDS) {
        if (body[key] === undefined) {
            continue;
        }
        if (body[key] !== null && !(typeof body[key] === 'number' && Number.isFinite(body[key]) && body[key] >= 0)) {
            return {error: 'errors.rest.invalidStudyField'};
        }
        aiLimits[key] = body[key];
    }
    let stepDocuments;
    if (body.stepDocuments !== undefined) {
        stepDocuments = readStepDocuments(body.stepDocuments);
        if (!stepDocuments) {
            return {error: 'errors.rest.invalidStudyField'};
        }
    }
    return {fields, stepDocuments, aiLimits};
}

/**
 * Read the step documents of a study. Each entry is { id: workflowStepId, documentId?, configuration? }.
 * Other keys are dropped.
 *
 * @param {*} raw the stepDocuments value from the body
 * @returns {Array<Object>|null} the step documents, or null when the shape is wrong
 */
function readStepDocuments(raw) {
    if (!Array.isArray(raw)) {
        return null;
    }
    const steps = [];
    for (const step of raw) {
        if (!step || typeof step !== 'object' || Array.isArray(step) || !Number.isInteger(step.id)) {
            return null;
        }
        const documentId = step.documentId ?? null;
        if (documentId !== null && !Number.isInteger(documentId)) {
            return null;
        }
        const configuration = step.configuration ?? {};
        if (typeof configuration !== 'object' || Array.isArray(configuration)) {
            return null;
        }
        steps.push({id: step.id, documentId, configuration});
    }
    return steps;
}

/**
 * Type-check each imported study the same way POST and PATCH do. Null values are treated as not set.
 *
 * @param {Array} items the parsed import entries
 * @returns {Object} {items} with the studies to create, or {error} with the error key to answer with 400
 */
function readImportStudies(items) {
    const studies = [];
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return {error: 'errors.rest.importContentRequired'};
        }
        // YAML parses timestamps into Date objects. The field check expects ISO strings.
        const present = Object.fromEntries(Object.entries(item)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
        const parsed = readStudyFields(present);
        if (parsed.error) {
            return {error: parsed.error};
        }
        let stepDocuments = parsed.stepDocuments;
        if (!stepDocuments && Array.isArray(item.study_step)) {
            // An export carries study_step rows; use them the way the dashboard import does.
            stepDocuments = readStepDocuments(stepDocumentsFromStudySteps(item.study_step.filter(is.object)));
            if (!stepDocuments) {
                return {error: 'errors.rest.invalidStudyField'};
            }
        }
        studies.push({...parsed.fields, stepDocuments, aiLimits: parsed.aiLimits});
    }
    return {items: studies};
}

/**
 * Read the export format from the query string. JSON when none is given.
 *
 * @param {Object} query express request query
 * @returns {string|null} 'json' or 'yaml', or null for an unsupported format
 */
function exportFormat(query) {
    const raw = typeof query?.format === 'string' ? query.format.toLowerCase() : 'json';
    if (raw === 'json') {
        return 'json';
    }
    if (raw === 'yaml' || raw === 'yml') {
        return 'yaml';
    }
    return null;
}

/**
 * Read the studies of an import: a JSON list, or {content, format} with JSON or YAML text.
 *
 * @param {Object|Array} body request body
 * @returns {Object} {items} with the parsed entries, or {error} with the error key to answer with 400
 */
function readImportItems(body) {
    if (Array.isArray(body)) {
        return {items: body};
    }
    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
        return {error: 'errors.rest.importContentRequired'};
    }
    const format = body.format === 'yaml' || body.format === 'yml' ? 'yaml' : 'json';
    if (body.format !== undefined && format === 'json' && body.format !== 'json') {
        return {error: 'errors.rest.unsupportedExportFormat'};
    }
    try {
        return {items: parseStudyImport(body.content, format)};
    } catch (err) {
        if (errorKey(err) === 'errors.rest.importContentRequired') {
            return {error: 'errors.rest.importContentRequired'};
        }
        return {error: 'errors.rest.importParseFailed'};
    }
}

module.exports = {
    STUDY_ERRORS,
    sendRestError,
    listedStudy,
    existingStudy,
    readStudyIds,
    readStudyFields,
    readImportStudies,
    exportFormat,
    readImportItems,
};
