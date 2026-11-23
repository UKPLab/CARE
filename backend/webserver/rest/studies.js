'use strict';

/**
 * Studies: visibility, list, get, create, update, and the field rules, for /rest/v1/studies.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const {Op} = require('sequelize');
const {canOf, loadByIdOrHash, pickFields} = require('../utils/restHelpers');

const STUDIES_FULL_ACCESS = 'frontend.dashboard.studies.fullAccess';

// What REST returns for a study. A new column stays out of REST until it is added here.
const STUDY_PUBLIC_FIELDS = [
    'id', 'hash', 'name', 'description', 'userId', 'createdByUserId', 'projectId', 'workflowId', 'tagSetId',
    'template', 'parentStudyId', 'closed', 'start', 'end', 'timeLimit', 'limitSessions', 'limitSessionsPerUser',
    'collab', 'anonymize', 'resumable', 'multipleSubmit', 'enableEmailNotifications', 'createdAt', 'updatedAt',
];

/**
 * The study fields REST returns.
 *
 * @param {Object} study the study row
 * @returns {Object} the public fields
 */
function publicStudy(study) {
    return pickFields(study, STUDY_PUBLIC_FIELDS);
}

const STUDY_FIELDS = [
    'name',
    'workflowId',
    'tagSetId',
    'description',
    'enableEmailNotifications',
    'timeLimit',
    'limitSessions',
    'limitSessionsPerUser',
    'start',
    'end',
    'collab',
    'anonymize',
    'resumable',
    'multipleSubmit',
];

/**
 * Whether the caller may change a study: its owner, or anyone with studies.fullAccess on the token.
 *
 * @param {Function} can checks a right of the token
 * @param {number} userId the token owner's user id
 * @param {Object|null} study the study row
 * @returns {Promise<boolean>}
 */
async function userCanManageStudy(can, userId, study) {
    if (!study) {
        return false;
    }
    return study.userId === userId || await can(STUDIES_FULL_ACCESS);
}

/**
 * Whether the caller created the study (or owns it, for rows without createdByUserId).
 *
 * @param {number} userId the token owner's user id
 * @param {Object} study the study row
 * @returns {boolean}
 */
function ownsStudyRecord(userId, study) {
    return (study.createdByUserId == null && study.userId === userId)
        || study.createdByUserId === userId;
}

/**
 * Whether the caller may see a study or template: they created it, or have studies.fullAccess on the token.
 *
 * @param {Function} can checks a right of the token
 * @param {number} userId the token owner's user id
 * @param {Object|null} study the study row
 * @returns {Promise<boolean>}
 */
async function userCanViewStudy(can, userId, study) {
    if (!study || study.deleted) {
        return false;
    }
    if (await can(STUDIES_FULL_ACCESS)) {
        return true;
    }
    return ownsStudyRecord(userId, study);
}

/**
 * Load a study by id or hash.
 *
 * @param {Object} models the database models
 * @param {number|string} idOrHash the study id or hash
 * @returns {Promise<Object|null>} the study, or null when it does not exist
 */
async function loadStudyByIdOrHash(models, idOrHash) {
    return loadByIdOrHash(models['study'], idOrHash);
}

/**
 * The studies one caller sees in the list, as a where clause: not templates, not deleted, the
 * caller's default project, and the Studies dashboard grid's own owner rule (none with fullAccess),
 * so REST and the dashboard agree. Used for the list and for one study, so the rule exists once.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Function} can checks a right of the token
 * @returns {Promise<Object>} the Sequelize where clause
 */
async function visibleStudiesWhere(models, userId, can) {
    const {defaultProjectFor} = require('./projects');
    const projectId = await defaultProjectFor(models, userId);
    const scope = await models['study'].getQueryTableScopeFilter({dashboard: true}, {userId, hasAccess: can});
    return {
        [Op.and]: [
            {template: {[Op.not]: true}},
            {deleted: {[Op.not]: true}},
            ...(projectId !== null ? [{projectId}] : []),
            ...(scope ? [scope] : []),
        ],
    };
}

/**
 * Whether a study is in the caller's study list.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Object} study the study row
 * @param {Function} can checks a right of the token
 * @returns {Promise<boolean>}
 */
async function studyVisibleInList(models, userId, study, can) {
    const where = await visibleStudiesWhere(models, userId, can);
    return (await models['study'].count({where: {[Op.and]: [where, {id: study.id}]}})) > 0;
}

/**
 * Throw when the caller may not change the study.
 *
 * @param {Object} options the REST options (can)
 * @param {number} userId the token owner's user id
 * @param {Object|null} study the study row
 * @param {string} errorKey the error key to throw
 * @returns {Promise<void>}
 * @throws {TranslatableError} with errorKey
 */
async function assertCanManageStudy(options, userId, study, errorKey) {
    if (!(await userCanManageStudy(canOf(options), userId, study))) {
        throw new TranslatableError(errorKey);
    }
}

/**
 * The step documents of a study, in the shape createStudy expects.
 *
 * @param {Object} models the database models
 * @param {number} studyId the study id
 * @returns {Promise<Array<Object>>} one {id, documentId, configuration} per workflow step
 */
async function stepDocumentsFromStudy(models, studyId) {
    const studySteps = await models['study_step'].getAllByKey('studyId', studyId) || [];
    const stepDocuments = [];
    for (const step of studySteps) {
        if (step.workflowStepId) {
            stepDocuments.push({
                id: step.workflowStepId,
                documentId: step.documentId,
                configuration: step.configuration,
            });
        }
    }
    return stepDocuments;
}

/**
 * A study owner can read every document in its steps, so linking a document is an access grant.
 * Keep only the three known keys and require access to each linked document.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Array<Object>} stepDocuments the step documents from the request
 * @param {Function} can checks a right of the token
 * @returns {Promise<Array<Object>>} the checked step documents
 * @throws {TranslatableError} errors.rest.stepDocumentNotFound or errors.rest.documentNoAccess
 */
async function checkedStepDocuments(models, userId, stepDocuments, can) {
    const {userHasDocumentAccess} = require('./documents');
    // All linked documents in one query; each document is access-checked once.
    const ids = [...new Set(stepDocuments.map((step) => step.documentId ?? null).filter((id) => id !== null))];
    const documents = ids.length === 0 ? [] : await models['document'].getAllByKeyValues('id', ids);
    const byId = new Map((documents || []).map((document) => [document.id, document]));
    const access = new Map();
    const checked = [];
    for (const step of stepDocuments) {
        const documentId = step.documentId ?? null;
        if (documentId !== null) {
            const document = byId.get(documentId);
            if (!document) {
                throw new TranslatableError('errors.rest.stepDocumentNotFound');
            }
            if (!access.has(documentId)) {
                access.set(documentId, await userHasDocumentAccess(models, userId, documentId, can, document));
            }
            if (!access.get(documentId)) {
                throw new TranslatableError('errors.rest.documentNoAccess');
            }
        }
        checked.push({id: step.id, documentId, configuration: step.configuration ?? {}});
    }
    return checked;
}

/**
 * The study fields REST may set, taken from a body or a template row.
 *
 * @param {Object} source the request fields or a study row
 * @returns {Object} the study fields that are set
 */
function pickStudyFields(source) {
    const fields = {};
    for (const key of STUDY_FIELDS) {
        if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            fields[key] = source[key];
        }
    }
    return fields;
}

/**
 * Mirrors the study table subscription in the Studies dashboard. Differs: fullAccess comes from the token.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the studies
 */
async function listStudies({userId}, options) {
    const models = options.models;
    return models['study'].findAll({
        where: await visibleStudiesWhere(models, userId, canOf(options)),
        order: [['createdAt', 'ASC']],
        raw: true,
    });
}

/**
 * Study templates the caller may create studies and assignments from. Same rule createStudy applies.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the templates
 */
async function listStudyTemplates({userId}, options) {
    const seeAll = await canOf(options)(STUDIES_FULL_ACCESS);
    const templates = await options.models['study'].findAll({
        where: {template: true, deleted: false},
        attributes: ['id', 'hash', 'name', 'description', 'workflowId', 'userId', 'createdByUserId'],
        order: [['id', 'ASC']],
        raw: true,
    });
    return templates
        .filter((template) => seeAll || ownsStudyRecord(userId, template))
        .map(({createdByUserId, ...template}) => template);
}

// Study-level AI cost limits. They are not study columns: the study model stores them as ai_budget
// rows (createBudgets), read from these keys in the save context, like the dashboard's study form.
const AI_LIMIT_FIELDS = ['aiCostLimitTotal', 'aiCostLimitPerSession', 'aiCostLimitPerUser'];

/**
 * The study-level AI cost limits of some studies (a number, or null for no limit).
 *
 * @param {Object} models the database models
 * @param {number[]} studyIds the study ids
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Map>} study id to {aiCostLimitTotal, aiCostLimitPerSession, aiCostLimitPerUser}
 */
async function studyAiLimits(models, studyIds, transaction) {
    const LT = models['ai_budget'].limitTypes;
    const keyOf = {[LT.TOTAL]: 'aiCostLimitTotal', [LT.PER_SESSION]: 'aiCostLimitPerSession', [LT.PER_USER]: 'aiCostLimitPerUser'};
    const limits = new Map(studyIds.map((id) => [id, Object.fromEntries(AI_LIMIT_FIELDS.map((key) => [key, null]))]));
    if (studyIds.length === 0) {
        return limits;
    }
    const rows = await models['ai_budget'].findAll({
        where: {studyId: studyIds, studyStepId: null, aiHookId: null, deleted: false},
        raw: true,
        transaction,
    });
    for (const row of rows) {
        if (keyOf[row.limitType] && limits.has(row.studyId)) {
            limits.get(row.studyId)[keyOf[row.limitType]] = Number(row.costLimit);
        }
    }
    return limits;
}

/**
 * Public study rows with their AI cost limits added, for REST answers.
 *
 * @param {Object} models the database models
 * @param {Array<Object>} studies the study rows
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Array<Object>>} the studies as REST returns them
 */
async function publicStudiesWithLimits(models, studies, transaction) {
    const limits = await studyAiLimits(models, studies.map((study) => study.id), transaction);
    return studies.map((study) => ({...publicStudy(study), ...limits.get(study.id)}));
}

/**
 * Set study-level AI cost limits on an existing study, in place, so the money already spent still
 * counts. A number above 0 sets the limit; 0 or null removes it. Keys not given stay as they are.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} studyId the study id
 * @param {Object} aiLimits the limits to set (see AI_LIMIT_FIELDS)
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<void>}
 */
async function applyAiLimits(models, userId, studyId, aiLimits, transaction) {
    const LT = models['ai_budget'].limitTypes;
    const typeOf = {aiCostLimitTotal: LT.TOTAL, aiCostLimitPerSession: LT.PER_SESSION, aiCostLimitPerUser: LT.PER_USER};
    const context = {currentUserId: userId};
    for (const [key, value] of Object.entries(aiLimits)) {
        const existing = await models['ai_budget'].findOne({
            where: {studyId, studyStepId: null, aiHookId: null, limitType: typeOf[key], deleted: false},
            raw: true,
            transaction,
        });
        if (value !== null && value > 0) {
            if (existing) {
                await models['ai_budget'].updateById(existing.id, {costLimit: value}, {transaction, context});
            } else {
                await models['ai_budget'].create({studyId, limitType: typeOf[key], costLimit: value, deleted: false}, {transaction, context});
            }
        } else if (existing) {
            await models['ai_budget'].deleteById(existing.id, {transaction, context});
        }
    }
}

/**
 * Mirrors appDataUpdate on the study table (create from template). Differs: template loaded by id, field allow-list.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.templateId the template to create the study from
 * @param {Object} data.fields the study fields
 * @param {Array<Object>} [data.stepDocuments] the step documents; the template's when not given
 * @param {Object} [data.aiLimits] the AI cost limits; the template's when not given
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object>} the new study
 * @throws {TranslatableError} when the template is missing, not visible, or not a template, or the name is empty
 */
async function createStudy({userId, templateId, fields, stepDocuments, aiLimits = {}}, options) {
    const models = options.models;
    const template = await models['study'].getById(templateId, {transaction: options.transaction});
    if (!template) {
        throw new TranslatableError('errors.rest.templateNotFound');
    }
    if (!(await userCanViewStudy(canOf(options), userId, template))) {
        throw new TranslatableError('errors.studies.notAllowedToSeeStudy');
    }
    if (!template.template) {
        throw new TranslatableError('errors.rest.notAStudyTemplate');
    }

    const payload = {
        ...pickStudyFields(template),
        ...pickStudyFields(fields),
        userId,
        template: false,
    };
    if (typeof payload.name === 'string') {
        payload.name = payload.name.trim();
    }
    if (!payload.name) {
        throw new TranslatableError('errors.rest.studyNameRequired');
    }

    const steps = Array.isArray(stepDocuments)
        ? await checkedStepDocuments(models, userId, stepDocuments, canOf(options))
        : await stepDocumentsFromStudy(models, template.id);

    // Without limits in the request the new study keeps the template's, like the dashboard form.
    const limits = {...(await studyAiLimits(models, [template.id], options.transaction)).get(template.id), ...aiLimits};
    return models['study'].add(payload, {
        transaction: options.transaction,
        context: {stepDocuments: steps, currentUserId: userId, ...limits},
    });
}

/**
 * Mirrors appDataUpdate on the study table (edit). Differs: field allow-list, owner or fullAccess checked.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.studyId the study id
 * @param {Object} data.fields the fields to change
 * @param {Array<Object>} [data.stepDocuments] new step documents, which make a new study version
 * @param {Object} [data.aiLimits] the AI cost limits to change
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Object|null>} the updated study (the new version when step documents changed), or null when it does not exist
 * @throws {TranslatableError} errors.studies.notAllowedToSeeStudy or errors.rest.studyNotEditable
 */
async function updateStudyFields({userId, studyId, fields, stepDocuments, aiLimits = {}}, options) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction: options.transaction});
    if (!study) {
        return null;
    }
    await assertCanManageStudy(options, userId, study, 'errors.studies.notAllowedToSeeStudy');
    if (study.template || study.closed) {
        throw new TranslatableError('errors.rest.studyNotEditable');
    }

    const allowed = pickStudyFields(fields);
    const context = {currentUserId: userId};
    if (Array.isArray(stepDocuments)) {
        context.stepDocuments = await checkedStepDocuments(models, userId, stepDocuments, canOf(options));
        // New step documents make a new study version; it keeps the limits unless the request changes them.
        Object.assign(context, (await studyAiLimits(models, [study.id], options.transaction)).get(study.id), aiLimits);
    } else {
        await applyAiLimits(models, userId, study.id, aiLimits, options.transaction);
    }
    const updated = await models['study'].updateById(study.id, allowed, {
        transaction: options.transaction,
        context,
    });
    if (!Array.isArray(stepDocuments)) {
        return updated;
    }

    const children = await models['study'].findAll({
        where: {parentStudyId: study.id, deleted: false},
        transaction: options.transaction,
        raw: true,
    });
    const newest = children.sort((a, b) => b.id - a.id)[0];
    return newest || updated;
}

module.exports = {
    AI_LIMIT_FIELDS,
    studyAiLimits,
    publicStudiesWithLimits,
    STUDY_FIELDS,
    assertCanManageStudy,
    checkedStepDocuments,
    createStudy,
    listStudies,
    listStudyTemplates,
    loadStudyByIdOrHash,
    ownsStudyRecord,
    pickStudyFields,
    publicStudy,
    stepDocumentsFromStudy,
    studyVisibleInList,
    updateStudyFields,
    userCanManageStudy,
    userCanViewStudy,
};
