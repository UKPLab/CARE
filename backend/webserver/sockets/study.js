const TranslatableError = require("../../utils/TranslatableError");
const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/helper/email");
const yaml = require('js-yaml');

/**
 * Study actions for /rest/v1/studies only. The socket methods below do not call these.
 * Pass userId. Do not read a user id from the request body.
 */

const STUDIES_FULL_ACCESS = 'frontend.dashboard.studies.fullAccess';

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

async function userIsAdmin(models, userId) {
    const roleIds = await models['user_role_matching'].getUserRolesById(userId);
    return models['user_role_matching'].isAdminInUserRoles(roleIds);
}

async function userHasRight(models, userId, right) {
    if (await userIsAdmin(models, userId)) {
        return true;
    }
    const roleIds = await models['user_role_matching'].getUserRolesById(userId);
    return models['user_role_matching'].hasAccessByUserRoles(roleIds, right);
}

async function userCanManageStudy(models, userId, study) {
    if (!study) {
        return false;
    }
    if (study.userId === userId) {
        return true;
    }
    return userIsAdmin(models, userId);
}

function ownsStudyRecord(userId, study) {
    return (study.createdByUserId == null && study.userId === userId)
        || study.createdByUserId === userId;
}

async function userCanViewStudy(models, userId, study) {
    if (!study || study.deleted) {
        return false;
    }
    if (await userHasRight(models, userId, STUDIES_FULL_ACCESS)) {
        return true;
    }
    return ownsStudyRecord(userId, study);
}

async function defaultProjectId(models, userId) {
    const raw = await models['user_setting'].get('projects.default', userId);
    const projectId = parseInt(raw, 10);
    return Number.isInteger(projectId) ? projectId : null;
}

function parseIdOrHash(idOrHash) {
    const raw = String(idOrHash);
    if (/^\d+$/.test(raw)) {
        return {identifierType: 'id', identifier: Number(raw)};
    }
    return {identifierType: 'hash', identifier: raw};
}

async function loadStudyByIdOrHash(models, idOrHash) {
    const {identifierType, identifier} = parseIdOrHash(idOrHash);
    if (identifierType === 'hash') {
        return models['study'].getByHash(identifier);
    }
    return models['study'].getById(identifier);
}

function studyRowVisible(study, userId, projectId, seeAll) {
    if (!study || study.template || study.deleted) {
        return false;
    }
    if (projectId !== null && study.projectId !== projectId) {
        return false;
    }
    if (seeAll) {
        return true;
    }
    return ownsStudyRecord(userId, study);
}

async function studyVisibleInList(models, userId, study) {
    const projectId = await defaultProjectId(models, userId);
    const seeAll = await userHasRight(models, userId, STUDIES_FULL_ACCESS);
    return studyRowVisible(study, userId, projectId, seeAll);
}

function normalizeStudyIds(studyIds) {
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
        throw new TranslatableError('errors.studies.studyIdRequired');
    }
    const ids = [];
    for (const raw of studyIds) {
        const id = Number(raw);
        if (!Number.isInteger(id)) {
            throw new TranslatableError('errors.studies.studyIdRequired');
        }
        ids.push(id);
    }
    return ids;
}

async function assertCanManageStudy(models, userId, study, errorKey) {
    if (!(await userCanManageStudy(models, userId, study))) {
        throw new TranslatableError(errorKey);
    }
}

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

function pickStudyFields(source) {
    const fields = {};
    for (const key of STUDY_FIELDS) {
        if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            fields[key] = source[key];
        }
    }
    return fields;
}

async function runForEachStudy(studyIds, options, action) {
    const ids = normalizeStudyIds(studyIds);
    if (options.transaction) {
        const studies = [];
        for (const id of ids) {
            studies.push(await action(id, options.transaction));
        }
        return studies;
    }

    const sequelize = options.models['study'].sequelize;
    const studies = [];
    for (const id of ids) {
        const transaction = await sequelize.transaction();
        try {
            const study = await action(id, transaction);
            await transaction.commit();
            studies.push(study);
        } catch (err) {
            try {
                await transaction.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            if (ids.length === 1) {
                throw err;
            }
            if (options.logger) {
                options.logger.error(err);
            }
        }
    }
    return studies;
}

async function listStudies({userId}, options) {
    const models = options.models;
    const studies = await models['study'].getAll() || [];
    const projectId = await defaultProjectId(models, userId);
    const seeAll = await userHasRight(models, userId, STUDIES_FULL_ACCESS);
    const visible = [];
    for (const study of studies) {
        if (studyRowVisible(study, userId, projectId, seeAll)) {
            visible.push(study);
        }
    }
    visible.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return visible;
}

async function createStudy({userId, templateId, fields, stepDocuments}, options) {
    const models = options.models;
    const template = await models['study'].getById(templateId, {transaction: options.transaction});
    if (!template) {
        throw new TranslatableError('errors.rest.templateNotFound');
    }
    if (!(await userCanViewStudy(models, userId, template))) {
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
        ? stepDocuments
        : await stepDocumentsFromStudy(models, template.id);

    return models['study'].add(payload, {
        transaction: options.transaction,
        context: {stepDocuments: steps, currentUserId: userId},
    });
}

async function updateStudyFields({userId, studyId, fields, stepDocuments}, options) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction: options.transaction});
    if (!study) {
        return null;
    }
    await assertCanManageStudy(models, userId, study, 'errors.studies.notAllowedToSeeStudy');
    if (study.template || study.closed) {
        throw new TranslatableError('errors.rest.studyNotEditable');
    }

    const allowed = pickStudyFields(fields);
    const context = {currentUserId: userId};
    if (Array.isArray(stepDocuments)) {
        context.stepDocuments = stepDocuments;
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

async function sendStudyClosedEmails(study, options) {
    if (!study) {
        return;
    }
    const models = options.models;
    const logger = options.logger;
    const server = options.server;
    if (!server || typeof server.sendMail !== 'function') {
        return;
    }
    const baseUrl = await models['setting'].get('system.baseUrl') || 'localhost:3000';

    try {
        const openSessions = await models['study_session'].getAllByKey('studyId', study.id);
        const unfinishedSessions = (openSessions || []).filter((session) => session.end === null && !session.deleted);
        if (unfinishedSessions.length === 0) {
            logger.info(`No open sessions found for study ${study.id}, skipping study close emails`);
            return;
        }

        const userIds = [...new Set(unfinishedSessions.map((session) => session.userId))];
        for (const sessionOwnerId of userIds) {
            try {
                const user = await models['user'].getById(sessionOwnerId);
                if (!user || !user.email) {
                    logger.warn(`Cannot send study closed email: user ${sessionOwnerId} has no email`);
                    continue;
                }
                const emailContent = await getEmailContent(
                    'email.template.studyClosed',
                    'studyClosed',
                    {
                        userId: sessionOwnerId,
                        studyId: study.id,
                        studyName: study.name,
                        baseUrl: baseUrl,
                        templateType: 6,
                    },
                    models,
                    logger
                );
                await server.sendMail(user.email, emailContent.subject, emailContent.body, {isHtml: emailContent.isHtml});
            } catch (error) {
                logger.error(`Failed to send study closed email to user ${sessionOwnerId}:`, error);
            }
        }
    } catch (error) {
        logger.error(`Failed to send study closed emails for study ${study.id}:`, error);
    }
}

async function closeOneStudy(studyId, {userId, notifySessions}, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(models, userId, study, 'errors.studies.noPermissionCloseStudy');
    if (study.closed) {
        throw new TranslatableError('errors.studies.studyAlreadyClosed');
    }

    const updated = await models['study'].updateById(studyId, {
        closed: true,
        userIdClosed: userId,
    }, {
        transaction,
        context: {currentUserId: userId},
    });

    if (notifySessions) {
        transaction.afterCommit(async () => {
            try {
                const fresh = await models['study'].getById(studyId);
                await sendStudyClosedEmails(fresh, options);
            } catch (error) {
                options.logger.error(`Failed to send study closed emails for study ${studyId}:`, error);
            }
        });
    }
    return updated;
}

async function closeStudies({userId, studyIds, notifySessions}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return closeOneStudy(id, {userId, notifySessions: notifySessions === true}, options, transaction);
    });
    return {closedCount: studies.length, studies};
}

async function openOneStudy(studyId, userId, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(models, userId, study, 'errors.studies.notAllowedToSeeStudy');
    return models['study'].updateById(studyId, {
        closed: null,
        userIdClosed: null,
    }, {
        transaction,
        context: {currentUserId: userId},
    });
}

async function openStudies({userId, studyIds}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return openOneStudy(id, userId, options, transaction);
    });
    return {openedCount: studies.length, studies};
}

async function deleteOneStudy(studyId, userId, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(models, userId, study, 'errors.studies.notAllowedToSeeStudy');
    return models['study'].deleteById(studyId, {
        transaction,
        context: {currentUserId: userId},
    });
}

async function deleteStudies({userId, studyIds}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return deleteOneStudy(id, userId, options, transaction);
    });
    return {deletedCount: studies.length, studies};
}

async function saveStudyAsTemplate({userId, id, onlyTemplate, templateData}, options) {
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
            },
        });
    }

    const currentStudy = await models['study'].getById(id, {transaction: options.transaction});
    if (!currentStudy) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(models, userId, currentStudy, 'errors.studies.noPermissionSaveAsTemplate');

    const stepDocuments = await stepDocumentsFromStudy(models, currentStudy.id);
    const newStudyData = {
        ...currentStudy,
        id: undefined,
        hash: undefined,
        template: true,
    };
    return models['study'].add(newStudyData, {
        transaction: options.transaction,
        context: {stepDocuments, currentUserId: userId},
    });
}

function stripExportChild(row) {
    return Object.fromEntries(
        Object.entries(row).filter(([key]) => !EXPORT_CHILD_STRIP.includes(key))
    );
}

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

function parseStudyImport(content, format) {
    const parsed = format === 'yaml' ? yaml.load(content) : JSON.parse(content);
    if (!Array.isArray(parsed)) {
        throw new TranslatableError('errors.rest.importContentRequired');
    }
    return parsed;
}

async function exportStudy({userId, studyId, format}, options) {
    const models = options.models;
    const study = await models['study'].getById(studyId);
    if (!study) {
        return null;
    }
    if (!(await userCanViewStudy(models, userId, study))) {
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

function importItemData(item) {
    return Object.fromEntries(
        Object.entries(item).filter(([key]) => !EXPORT_CHILD_STRIP.includes(key) && key !== 'study_step')
    );
}

async function importStudies({userId, items}, options) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new TranslatableError('errors.rest.importContentRequired');
    }
    const created = [];
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new TranslatableError('errors.rest.importContentRequired');
        }
        const template = await saveStudyAsTemplate({
            userId,
            onlyTemplate: true,
            templateData: importItemData(item),
        }, options);
        created.push(template);
    }
    return created;
}

/**
 * Handle all studies through websocket
 *
 * Loading the studies through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 * @class StudySocket
 */
class StudySocket extends Socket {
    
    async hasManageStudiesPermission() {
        const hasPermission = await this.hasAccess("frontend.dashboard.studies.canManageStudies");
        if (!hasPermission) {
            throw new TranslatableError("errors.studies.noPermissionManageStudies");
        }
    }

    /**
     * Creates a new study template based on an existing study or directly from data.
     * This operation is restricted to the owner of the original study or an administrator.
     * 
     * @socketEvent studySaveAsTemplate
     * @param {object} data The data object containing the identifier for the source study or template data.
     * @param {number} data.id the ID of the study to save as template (required if onlyTemplate is false)
     * @param {boolean} data.onlyTemplate if true, creates template directly from provided data without creating a study
     * @param {object} data.templateData the template data when onlyTemplate is true
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object.
     * @returns {Promise<*>} A promise that resolves with the newly created study template object from the database.
     * @throws {Error} Throws an error if the user does not have permission to access the source study.
     */
    async saveStudyAsTemplate(data, options) {
        if (data.onlyTemplate && data.templateData) {
            const templateData = {
                ...data.templateData,
                userId: this.socket.user.id,
                template: true,
            };
            
            return await this.models['study'].add(templateData, {
                transaction: options.transaction,
                context: { stepDocuments: data.templateData.stepDocuments || [] }
            });
        } else {
            const currentStudy = await this.models['study'].getById(data['id']);

            if (await this.checkUserAccess(currentStudy.userId)) {
                const studySteps = await this.models['study_step'].getAllByKey("studyId", currentStudy.id);
                
                const stepDocuments = [];
                for (const step of studySteps) {
                    if (step.workflowStepId) {
                        stepDocuments.push({
                            id: step.workflowStepId,
                            documentId: step.documentId,
                            configuration: step.configuration
                        });
                    }
                }

                const newStudyData = {
                    ...currentStudy,
                    id: undefined,
                    hash: undefined,
                    template: true,
                };
                
                return await this.models['study'].add(newStudyData, {
                    transaction: options.transaction,
                    context: { stepDocuments: stepDocuments }
                });
            } else {
                throw new TranslatableError("errors.studies.noPermissionSaveAsTemplate");
            }
        }
    }

    /**
     * Send study closed email to users with open/unfinished sessions.
     * Uses Type 6 templates configured in settings.
     * @param {Object} study - Study object
     * @returns {Promise<void>}
     */
    async sendStudyClosedEmails(study) {
        const baseUrl = await this.models["setting"].get("system.baseUrl") || "localhost:3000";

        try {
            const openSessions = await this.models["study_session"].getAllByKey(
                "studyId",
                study.id,
            );
            
            const unfinishedSessions = openSessions.filter(
                (s) => s.end === null && !s.deleted,
            );

            if (unfinishedSessions.length === 0) {
                this.logger.info(`No open sessions found for study ${study.id}, skipping study close emails`);
                return;
            }

            const userIds = [...new Set(unfinishedSessions.map(s => s.userId))];

            for (const sessionOwnerId of userIds) {
                try {
                    const user = await this.models['user'].getById(sessionOwnerId);
                    if (!user || !user.email) {
                        this.logger.warn(`Cannot send study closed email: user ${sessionOwnerId} has no email`);
                        continue;
                    }

                    const emailContent = await getEmailContent(
                        "email.template.studyClosed",
                        "studyClosed",
                        {
                            userId: sessionOwnerId,
                            studyId: study.id,
                            studyName: study.name,
                            baseUrl: baseUrl,
                            templateType: 6
                        },
                        this.models,
                        this.logger
                    );

                    await this.server.sendMail(user.email, emailContent.subject, emailContent.body, { isHtml: emailContent.isHtml });
                } catch (error) {
                    this.logger.error(`Failed to send study closed email to user ${sessionOwnerId}:`, error);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to send study closed emails for study ${study.id}:`, error);
        }
    }

    /**
     * Close a single study by setting its closed flag.
     * Validates that the study exists and is not already closed.
     * Sends study closed emails after the transaction commits (optional, based on notifySessions flag).
     *
     * @socketEvent studyClose
     * @param {object} data The data required to close the study.
     * @param {number} data.studyId The ID of the study to close.
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<Object>} The updated study object.
     */
    async closeStudy(data, options) {
        if (!data.studyId) {
            throw new TranslatableError("errors.studies.studyIdRequired");
        }

        const study = await this.models["study"].getById(data.studyId, {transaction: options.transaction});
        if (!study) {
            throw new TranslatableError("errors.studies.studyNotFound");
        }
        if (!(await this.checkUserAccess(study.userId))) {
            throw new TranslatableError("errors.studies.noPermissionCloseStudy");
        }

        if (study.closed) {
            throw new TranslatableError("errors.studies.studyAlreadyClosed");
        }

        const updatedStudy = await this.models["study"].updateById(
            data.studyId,
            {closed: true},
            {transaction: options.transaction}
        );

        const notifySessions = data.notifySessions === true;

        options.transaction.afterCommit(async () => {
            if (!notifySessions) {
                return;
            }
            try {
                const updatedStudy = await this.models["study"].getById(data.studyId);
                await this.sendStudyClosedEmails(updatedStudy);
            } catch (error) {
                this.logger.error(`Failed to send study closed emails for study ${data.studyId}:`, error);
            }
        });

        return updatedStudy;
    }


    /**
     * Closes studies identified by studyIds.
     *
     * @socketEvent studyCloseBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to close
     * @param {number} [data.projectId] optional project scope for validation
     * @param {boolean} [data.notifySessions] if true, send emails to participants with open sessions
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ closedCount: number }>}
     */
    async closeBulk(data, options) {
        await this.hasManageStudiesPermission();

        const notifySessions = data.notifySessions === true;

        const closedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: true, userIdClosed: this.userId },
                { transaction }
            );
            transaction.afterCommit(async () => {
                this.broadcastTransactionChanges(transaction);
                if (notifySessions) {
                    try {
                        const updated = await this.models["study"].getById(id);
                        await this.sendStudyClosedEmails(updated);
                    } catch (err) {
                        this.logger.error(`Failed to send study closed emails for study ${id}:`, err);
                    }
                }
            });
        });

        return { closedCount };
    }

    /**
     * Reopens studies identified by studyIds.
     *
     * @socketEvent studyOpenBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to reopen
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ openedCount: number }>}
     */
    async openBulk(data, options) {
        await this.hasManageStudiesPermission();

        const openedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: null, userIdClosed: null },
                { transaction }
            );
            transaction.afterCommit(() => this.broadcastTransactionChanges(transaction));
        });

        return { openedCount };
    }

    /**
     * Soft-deletes studies identified by studyIds.
     *
     * @socketEvent studyDeleteBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to delete
     * @param {number} [data.projectId] optional project scope for validation
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ deletedCount: number }>}
     */
    async deleteBulk(data, options) {
        await this.hasManageStudiesPermission();

        const deletedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { deleted: true },
                { transaction }
            );
            transaction.afterCommit(() => this.broadcastTransactionChanges(transaction));
        });

        return { deletedCount };
    }

    async init() {
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);
        this.createSocket("studyOpenBulk", this.openBulk, {}, false);
        this.createSocket("studyDeleteBulk", this.deleteBulk, {}, false);
        this.createSocket("studyClose", this.closeStudy, {}, true);
    }
}

module.exports = StudySocket;module.exports.STUDY_FIELDS = STUDY_FIELDS;
module.exports.listStudies = listStudies;
module.exports.loadStudyByIdOrHash = loadStudyByIdOrHash;
module.exports.userCanViewStudy = userCanViewStudy;
module.exports.studyVisibleInList = studyVisibleInList;
module.exports.createStudy = createStudy;
module.exports.updateStudyFields = updateStudyFields;
module.exports.closeStudies = closeStudies;
module.exports.openStudies = openStudies;
module.exports.deleteStudies = deleteStudies;
module.exports.saveStudyAsTemplate = saveStudyAsTemplate;
module.exports.exportStudy = exportStudy;
module.exports.importStudies = importStudies;
module.exports.parseStudyImport = parseStudyImport;
module.exports.sendStudyClosedEmails = sendStudyClosedEmails;