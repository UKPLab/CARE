'use strict';

/**
 * Study templates, export, and import, for /rest/v1/studies/:idOrHash/template, /export, and /import.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const yaml = require('js-yaml');
const {assertCanManageStudy, checkedStepDocuments, pickStudyFields, stepDocumentsFromStudy, studyAiLimits, userCanViewStudy} = require('./studies');
const {canOf} = require('../utils/restHelpers');

// ExportFormatModal strips these from child rows. The parent row only drops id.
const EXPORT_CHILD_STRIP = [
    'draft',
    'anonymous',
    'createdAt',
    'updatedAt',
    'deleted',
    'deletedAt',
    'userId',
    'id',
];

/**
 * Mirrors StudySocket.saveStudyAsTemplate (studySaveAsTemplate). Differs: owner or fullAccess from the token.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} [data.id] the study to save as a template
 * @param {boolean} [data.onlyTemplate] create the template from templateData instead
 * @param {Object} [data.templateData] the template fields, with onlyTemplate
 * @param {Object} [data.aiLimits] the AI cost limits, with onlyTemplate
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object>} the new template
 * @throws {TranslatableError} errors.studies.studyNotFound or errors.studies.noPermissionSaveAsTemplate
 */
async function saveStudyAsTemplate({userId, id, onlyTemplate, templateData, aiLimits = {}}, options) {
    const models = options.models;
    if (onlyTemplate && templateData) {
        const data = {
            ...templateData,
            userId,
            template: true,
        };
        delete data.id;
        delete data.hash;
        return models['study'].add(data, {
            transaction: options.transaction,
            context: {
                stepDocuments: templateData.stepDocuments || [],
                currentUserId: userId,
                ...aiLimits,
            },
        });
    }

    const currentStudy = await models['study'].getById(id, {transaction: options.transaction});
    if (!currentStudy) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(options, userId, currentStudy, 'errors.studies.noPermissionSaveAsTemplate');

    const stepDocuments = await stepDocumentsFromStudy(models, currentStudy.id);
    const newStudyData = {
        ...currentStudy,
        id: undefined,
        hash: undefined,
        template: true,
    };
    // The template keeps the study's AI cost limits, like the dashboard's "save as template".
    const limits = (await studyAiLimits(models, [currentStudy.id], options.transaction)).get(currentStudy.id);
    return models['study'].add(newStudyData, {
        transaction: options.transaction,
        context: {stepDocuments, currentUserId: userId, ...limits},
    });
}

/**
 * Drop the columns the dashboard export leaves out of child rows.
 *
 * @param {Object} row a study_step row
 * @returns {Object} the row without those columns
 */
function stripExportChild(row) {
    return Object.fromEntries(
        Object.entries(row).filter(([key]) => !EXPORT_CHILD_STRIP.includes(key))
    );
}

/**
 * The export records: each study without its id, with its study_step rows.
 *
 * @param {Array<Object>} studies the study rows
 * @param {Object} stepsByStudyId study id to its study_step rows
 * @returns {Array<Object>} the records
 */
function buildStudyExportRecords(studies, stepsByStudyId) {
    return studies.map((study) => {
        const children = (stepsByStudyId[study.id] || [])
            .filter((step) => !step.deleted)
            .map((step) => stripExportChild(step));
        const withChildren = {...study, study_step: children};
        return Object.fromEntries(
            Object.entries(withChildren).filter(([key]) => key !== 'id')
        );
    });
}

/**
 * Write the export records as JSON or YAML text.
 *
 * @param {Array<Object>} records the export records
 * @param {string} format 'json' or 'yaml'
 * @returns {string} the file content
 */
function serializeStudyExport(records, format) {
    if (format === 'yaml') {
        return yaml.dump(records, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: true,
        });
    }
    return JSON.stringify(records, null, 2);
}

/**
 * Parse import text as JSON or YAML. The content must be a list.
 *
 * @param {string} content the file content
 * @param {string} format 'json' or 'yaml'
 * @returns {Array} the parsed entries
 * @throws {TranslatableError} errors.rest.importContentRequired when the content is not a list
 */
function parseStudyImport(content, format) {
    const parsed = format === 'yaml' ? yaml.load(content) : JSON.parse(content);
    if (!Array.isArray(parsed)) {
        throw new TranslatableError('errors.rest.importContentRequired');
    }
    return parsed;
}

/**
 * Mirrors the dashboard export modal for study and study_step. Same file shape.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.studyId the study id
 * @param {string} data.format 'json' or 'yaml'
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Object|null>} {format, body, filename}, or null when the study does not exist
 * @throws {TranslatableError} errors.studies.notAllowedToSeeStudy
 */
async function exportStudy({userId, studyId, format}, options) {
    const models = options.models;
    const study = await models['study'].getById(studyId);
    if (!study) {
        return null;
    }
    if (!(await userCanViewStudy(canOf(options), userId, study))) {
        throw new TranslatableError('errors.studies.notAllowedToSeeStudy');
    }
    const steps = await models['study_step'].getAllByKey('studyId', study.id) || [];
    const records = buildStudyExportRecords([study], {[study.id]: steps});
    const extension = format === 'yaml' ? 'yaml' : 'json';
    return {
        format: extension,
        body: serializeStudyExport(records, format === 'yaml' ? 'yaml' : 'json'),
        filename: `study_${study.id}.${extension}`,
    };
}

/**
 * Mirrors the dashboard import modal (studySaveAsTemplate with onlyTemplate). Differs: study field allow-list.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Array<Object>} data.items the checked import entries
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Array<Object>>} the new templates
 * @throws {TranslatableError} errors.rest.importContentRequired
 */
async function importStudies({userId, items}, options) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new TranslatableError('errors.rest.importContentRequired');
    }
    const created = [];
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new TranslatableError('errors.rest.importContentRequired');
        }
        // Allow-list: an imported file must not set owner, closed state, parent, or other columns.
        const stepDocuments = Array.isArray(item.stepDocuments)
            ? await checkedStepDocuments(options.models, userId, item.stepDocuments, canOf(options))
            : [];
        const template = await saveStudyAsTemplate({
            userId,
            onlyTemplate: true,
            templateData: {...pickStudyFields(item), stepDocuments},
            aiLimits: item.aiLimits || {},
        }, options);
        created.push(template);
    }
    return created;
}

module.exports = {
    exportStudy,
    importStudies,
    parseStudyImport,
    saveStudyAsTemplate,
};
