'use strict';

/**
 * Study open, close, and delete, one study or many (one transaction per study), for /rest/v1/studies.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const {assertCanManageStudy} = require('./studies');
const {getEmailContent} = require('../../utils/helper/email');

/**
 * Turn the given study ids into integers.
 *
 * @param {Array} studyIds the study ids
 * @returns {number[]} the ids
 * @throws {TranslatableError} errors.studies.studyIdRequired when the list is empty or an id is not an integer
 */
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

/**
 * Run an action for each study. Inside a transaction all run in it; otherwise each study gets its own
 * transaction, and a failed study is logged and skipped (one study alone throws instead).
 *
 * @param {Array} studyIds the study ids
 * @param {Object} options the REST options (models, transaction, startTransaction, logger)
 * @param {Function} action receives the study id and a transaction, returns the changed study
 * @returns {Promise<Array<Object>>} the studies that were changed
 */
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
        const transaction = options.startTransaction
            ? await options.startTransaction()
            : await sequelize.transaction();
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

/**
 * Mirrors StudySocket.sendStudyClosedEmails, close copy. Differs: models and server passed in, no this.
 *
 * @param {Object|null} study the closed study
 * @param {Object} options the REST options (models, server, logger)
 * @returns {Promise<void>}
 */
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

/**
 * Close one study the caller may manage. With notifySessions, emails go out after commit.
 *
 * @param {number} studyId the study id
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {boolean} data.notifySessions email users with open sessions
 * @param {Object} options the REST options (models, can, logger)
 * @param {Object} transaction the Sequelize transaction
 * @returns {Promise<Object>} the closed study
 * @throws {TranslatableError} when the study is missing, not manageable, or already closed
 */
async function closeOneStudy(studyId, {userId, notifySessions}, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(options, userId, study, 'errors.studies.noPermissionCloseStudy');
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
        // Not returned, so the answer does not wait for mail delivery. One request's close emails
        // share one queue, study after study, so a bulk close of 100 studies does not open 100 mail
        // connections at once. Failures are logged.
        transaction.afterCommit(() => {
            options.closeMailQueue = (options.closeMailQueue || Promise.resolve()).then(async () => {
                try {
                    const fresh = await models['study'].getById(studyId);
                    await sendStudyClosedEmails(fresh, options);
                } catch (error) {
                    options.logger.error(`Failed to send study closed emails for study ${studyId}:`, error);
                }
            });
        });
    }
    return updated;
}

/**
 * Mirrors StudySocket.closeStudy and closeBulk (studyClose, studyCloseBulk). Differs: no progress events.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number[]} data.studyIds the study ids
 * @param {boolean} [data.notifySessions] email users with open sessions
 * @param {Object} options the REST options (models, can, logger)
 * @returns {Promise<Object>} {closedCount, studies}
 */
async function closeStudies({userId, studyIds, notifySessions}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return closeOneStudy(id, {userId, notifySessions: notifySessions === true}, options, transaction);
    });
    return {closedCount: studies.length, studies};
}

/**
 * Reopen one study the caller may manage.
 *
 * @param {number} studyId the study id
 * @param {number} userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @param {Object} transaction the Sequelize transaction
 * @returns {Promise<Object>} the reopened study
 * @throws {TranslatableError} errors.studies.studyNotFound or errors.studies.notAllowedToSeeStudy
 */
async function openOneStudy(studyId, userId, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(options, userId, study, 'errors.studies.notAllowedToSeeStudy');
    return models['study'].updateById(studyId, {
        closed: null,
        userIdClosed: null,
    }, {
        transaction,
        context: {currentUserId: userId},
    });
}

/**
 * Mirrors StudySocket.openBulk (studyOpenBulk) and Restart in the dashboard. Differs: no progress events.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number[]} data.studyIds the study ids
 * @param {Object} options the REST options (models, can, logger)
 * @returns {Promise<Object>} {openedCount, studies}
 */
async function openStudies({userId, studyIds}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return openOneStudy(id, userId, options, transaction);
    });
    return {openedCount: studies.length, studies};
}

/**
 * Soft-delete one study the caller may manage.
 *
 * @param {number} studyId the study id
 * @param {number} userId the token owner's user id
 * @param {Object} options the REST options (models, can)
 * @param {Object} transaction the Sequelize transaction
 * @returns {Promise<Object>} the deleted study
 * @throws {TranslatableError} errors.studies.studyNotFound or errors.studies.notAllowedToSeeStudy
 */
async function deleteOneStudy(studyId, userId, options, transaction) {
    const models = options.models;
    const study = await models['study'].getById(studyId, {transaction});
    if (!study) {
        throw new TranslatableError('errors.studies.studyNotFound');
    }
    await assertCanManageStudy(options, userId, study, 'errors.studies.notAllowedToSeeStudy');
    return models['study'].deleteById(studyId, {
        transaction,
        context: {currentUserId: userId},
    });
}

/**
 * Mirrors StudySocket.deleteBulk (studyDeleteBulk). Differs: no progress events.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number[]} data.studyIds the study ids
 * @param {Object} options the REST options (models, can, logger)
 * @returns {Promise<Object>} {deletedCount, studies}
 */
async function deleteStudies({userId, studyIds}, options) {
    const studies = await runForEachStudy(studyIds, options, (id, transaction) => {
        return deleteOneStudy(id, userId, options, transaction);
    });
    return {deletedCount: studies.length, studies};
}

module.exports = {
    closeStudies,
    deleteStudies,
    openStudies,
    sendStudyClosedEmails,
};
