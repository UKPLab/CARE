'use strict';

/**
 * Study sessions: list, start, finish, copy, delete, for /rest/v1/sessions and /rest/v1/studies/:idOrHash/sessions.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require("../../utils/TranslatableError");
const {canOf} = require('../utils/restHelpers');
const {getEmailContent} = require('../../utils/helper/email');
const {userCanViewStudy, ownsStudyRecord, userCanManageStudy} = require('./studies');
const {loadUsersByIds} = require('./users');

const SESSION_FIELDS = ['id', 'hash', 'studyId', 'userId', 'studyStepId', 'numberSteps', 'start', 'end', 'createdAt'];

/**
 * The session fields REST returns.
 *
 * @param {Object} session the study session row
 * @returns {Object} the public fields
 */
function publicSession(session) {
    return Object.fromEntries(SESSION_FIELDS.map((key) => [key, session[key] ?? null]));
}

/**
 * Sessions of one study, or the caller's own sessions when no study is given.
 * Someone who may see the study gets all its sessions. Anyone else gets only their own.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} [data.study] the study row
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the sessions
 */
async function listStudySessions({userId, study}, options) {
    const models = options.models;
    if (!study) {
        return (await models['study_session'].getAllByKey('userId', userId)).map(publicSession);
    }
    const sessions = await models['study_session'].getAllByKey('studyId', study.id);
    const seeAll = await userCanViewStudy(canOf(options), userId, study);
    return sessions.filter((session) => seeAll || session.userId === userId).map(publicSession);
}

/**
 * One session: the caller's own, or any session of a study the caller may see.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object|null} data.session the study session row
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Object|null>} the session, or null when it does not exist
 * @throws {TranslatableError} errors.rest.sessionNoAccess
 */
async function getStudySession({userId, session}, options) {
    if (!session) {
        return null;
    }
    if (session.userId !== userId) {
        const study = await options.models['study'].getById(session.studyId);
        if (!(await userCanViewStudy(canOf(options), userId, study))) {
            throw new TranslatableError('errors.rest.sessionNoAccess');
        }
    }
    return publicSession(session);
}

/**
 * Soft-delete a session of a study the caller created, or any with studies.fullAccess on the token.
 * Mirrors the delete action of StudySessionTable.vue (appDataUpdate with deleted on study_session).
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} data.session the study session row
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<boolean>} true
 * @throws {TranslatableError} errors.rest.sessionNoAccess
 */
async function deleteStudySession({userId, session}, options) {
    const study = await options.models['study'].getById(session.studyId, {transaction: options.transaction});
    if (!(study && ownsStudyRecord(userId, study)) && !(await canOf(options)('frontend.dashboard.studies.fullAccess'))) {
        throw new TranslatableError('errors.rest.sessionNoAccess');
    }
    await options.models['study_session'].deleteById(session.id, {transaction: options.transaction});
    return true;
}

/**
 * Load one of the caller's own sessions.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} sessionId the study session id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object>} the session
 * @throws {TranslatableError} errors.rest.sessionNotFound or errors.rest.sessionNoAccess
 */
async function loadOwnSession(models, userId, sessionId, transaction) {
    const session = await models['study_session'].getById(sessionId, {transaction});
    if (!session) {
        throw new TranslatableError('errors.rest.sessionNotFound');
    }
    if (session.userId !== userId) {
        throw new TranslatableError('errors.rest.sessionNoAccess');
    }
    return session;
}

/**
 * Mirrors StudySessionSocket.sendSessionStartEmail and sendSessionFinishEmail, merged into one.
 *
 * @param {string} kind 'sessionStart' or 'sessionFinish'
 * @param {Object} session the study session row
 * @param {Object} options the REST options (models, server, logger)
 * @returns {Promise<void>}
 */
async function sendSessionEmail(kind, session, options) {
    const models = options.models;
    const study = await models['study'].getById(session.studyId);
    if (!study || !study.enableEmailNotifications || (kind === 'sessionFinish' && study.closed)) {
        return;
    }
    const owner = await models['user'].getById(study.userId);
    if (!owner || !owner.email) {
        options.logger.warn(`Cannot send ${kind} email: user ${study.userId} has no email`);
        return;
    }
    const baseUrl = await models['setting'].get('system.baseUrl') || 'localhost:3000';
    const context = {
        userId: study.userId,
        creatorId: study.userId,
        studyId: study.id,
        studySessionId: session.id,
        studySessionHash: session.hash,
        baseUrl,
    };
    if (kind === 'sessionFinish') {
        context.reviewLink = `http://${baseUrl}/review/${session.hash}`;
    }
    const content = await getEmailContent(`email.template.${kind}`, kind, context, models, options.logger);
    await options.server.sendMail(owner.email, content.subject, content.body, {isHtml: content.isHtml});
}

/**
 * Send the session email once the transaction has committed. Failures are logged.
 *
 * @param {string} kind 'sessionStart' or 'sessionFinish'
 * @param {Object} session the study session row
 * @param {Object} options the REST options (transaction, logger)
 * @returns {void}
 */
function emailAfterCommit(kind, session, options) {
    options.transaction.afterCommit(() => sendSessionEmail(kind, session, options)
        .catch((error) => options.logger.error(`Failed to send ${kind} email: ` + error)));
}

/**
 * Start a new session in a study for the caller, or set the start time of one of their sessions.
 * Same result as studySessionStart.
 * Mirrors StudySessionSocket.startStudySession (studySessionStart). Differs: own sessions only.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} [data.study] the study to start a new session in
 * @param {number} [data.sessionId] the own session to start instead
 * @param {Object} options the REST options (models, transaction, logger)
 * @returns {Promise<Object>} the session
 * @throws {TranslatableError} errors.rest.studyNotEditable
 */
async function startStudySession({userId, study, sessionId}, options) {
    const models = options.models;
    const transaction = options.transaction;
    if (sessionId != null) {
        const existing = await loadOwnSession(models, userId, sessionId, transaction);
        const session = await models['study_session'].updateById(existing.id, {start: Date.now()}, {transaction});
        if (existing.start == null) {
            emailAfterCommit('sessionStart', session, options);
        }
        return publicSession(session);
    }
    if (study.template) {
        throw new TranslatableError('errors.rest.studyNotEditable');
    }
    // Checked here, not left to the model: its beforeCreate skips the check for new sessions
    // (parentStudySessionId is undefined there, not null), and its closed check also needs the end
    // date to have passed. The dashboard only hides the Start button; a script has no button.
    if (study.closed) {
        throw new TranslatableError('errors.studies.studyClosed');
    }
    await models['study_session'].checkSessionAvailability(study.id, userId, {transaction});
    const session = await models['study_session'].add({studyId: study.id, userId, start: Date.now()}, {transaction});
    emailAfterCommit('sessionStart', session, options);
    return publicSession(session);
}

/**
 * Finish one of the caller's sessions. Same result as studySessionFinish.
 * Mirrors StudySessionSocket.finishStudySession (studySessionFinish). Differs: own sessions only.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.sessionId the study session id
 * @param {Object} options the REST options (models, transaction, logger)
 * @returns {Promise<Object>} the finished session
 * @throws {TranslatableError} when the session is already finished or its study is closed
 */
async function finishStudySession({userId, sessionId}, options) {
    const models = options.models;
    const transaction = options.transaction;
    const session = await loadOwnSession(models, userId, sessionId, transaction);
    if (session.end) {
        throw new TranslatableError('errors.studies.studySession.alreadyFinished');
    }
    const study = await models['study'].getById(session.studyId, {transaction});
    if (study && study.closed) {
        throw new TranslatableError('errors.studies.studySession.cannotFinishClosedStudy');
    }
    const updated = await models['study_session'].updateById(session.id, {end: Date.now()}, {transaction});
    emailAfterCommit('sessionFinish', updated, options);
    return publicSession(updated);
}

/**
 * Give copies of a session to other users. Only someone who may manage the study can do this.
 * Raises the study's session limits the same way studySessionCopy does.
 * Mirrors StudySessionSocket.copyStudySession (studySessionCopy). Differs: manage right from the token, target users checked.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.sessionId the session to copy
 * @param {number[]} data.userIds the users who get a copy
 * @param {Object} options the REST options (models, transaction, can)
 * @returns {Promise<Array<Object>>} the copies
 * @throws {TranslatableError} errors.rest.sessionNotFound, errors.rest.sessionNoAccess, or errors.rest.reviewerNotFound
 */
async function copyStudySession({userId, sessionId, userIds}, options) {
    const models = options.models;
    const transaction = options.transaction;
    const source = await models['study_session'].getById(sessionId, {transaction});
    if (!source) {
        throw new TranslatableError('errors.rest.sessionNotFound');
    }
    const study = await models['study'].getById(source.studyId, {transaction});
    if (!(await userCanManageStudy(canOf(options), userId, study))) {
        throw new TranslatableError('errors.rest.sessionNoAccess');
    }
    const targets = [...new Set(userIds)];
    await loadUsersByIds(models, targets, transaction);
    const limits = {};
    if (study.limitSessionsPerUser !== null) {
        limits.limitSessionsPerUser = study.limitSessionsPerUser + 1;
    }
    if (study.limitSessions !== null) {
        limits.limitSessions = study.limitSessions + targets.length;
    }
    if (Object.keys(limits).length > 0) {
        await models['study'].updateById(study.id, limits, {transaction});
    }
    const copies = [];
    for (const id of targets) {
        copies.push(await models['study_session'].duplicateStudySession(source.id, {userId: id}, options));
    }
    return copies.map(publicSession);
}

module.exports = {
    copyStudySession,
    deleteStudySession,
    finishStudySession,
    getStudySession,
    listStudySessions,
    startStudySession,
};
