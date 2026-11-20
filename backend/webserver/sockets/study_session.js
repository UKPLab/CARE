const TranslatableError = require("../../utils/TranslatableError");
const {canOf} = require('../utils/restHelpers');
const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/helper/email");

/**
 * Study session actions for /rest/v1 only. The socket methods below do not call these.
 * The acting user comes from the token. A caller starts and finishes only their own sessions.
 */

const SESSION_FIELDS = ['id', 'hash', 'studyId', 'userId', 'studyStepId', 'numberSteps', 'start', 'end', 'createdAt'];

function publicSession(session) {
    return Object.fromEntries(SESSION_FIELDS.map((key) => [key, session[key] ?? null]));
}

/**
 * Sessions of one study, or the caller's own sessions when no study is given.
 * Someone who may see the study gets all its sessions. Anyone else gets only their own.
 */
async function listStudySessions({userId, study}, options) {
    const {userCanViewStudy} = require('./study');
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
 * @returns {Promise<Object|null>} null when the session does not exist
 * @throws {TranslatableError} errors.rest.sessionNoAccess
 */
async function getStudySession({userId, session}, options) {
    const {userCanViewStudy} = require('./study');
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
 */
async function deleteStudySession({userId, session}, options) {
    const {ownsStudyRecord} = require('./study');
    const study = await options.models['study'].getById(session.studyId, {transaction: options.transaction});
    if (!(study && ownsStudyRecord(userId, study)) && !(await canOf(options)('frontend.dashboard.studies.fullAccess'))) {
        throw new TranslatableError('errors.rest.sessionNoAccess');
    }
    await options.models['study_session'].deleteById(session.id, {transaction: options.transaction});
    return true;
}

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

function emailAfterCommit(kind, session, options) {
    options.transaction.afterCommit(() => sendSessionEmail(kind, session, options)
        .catch((error) => options.logger.error(`Failed to send ${kind} email: ` + error)));
}

/**
 * Start a new session in a study for the caller, or set the start time of one of their sessions.
 * Same result as studySessionStart.
 * Mirrors StudySessionSocket.startStudySession (studySessionStart). Differs: own sessions only.
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
    // The model checks the study is open and the session limits before it creates the row.
    const session = await models['study_session'].add({studyId: study.id, userId, start: Date.now()}, {transaction});
    emailAfterCommit('sessionStart', session, options);
    return publicSession(session);
}

/**
 * Finish one of the caller's sessions. Same result as studySessionFinish.
 * Mirrors StudySessionSocket.finishStudySession (studySessionFinish). Differs: own sessions only.
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
 */
async function copyStudySession({userId, sessionId, userIds}, options) {
    const {userCanManageStudy} = require('./study');
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
    const users = await models['user'].findAll({
        where: {id: targets, deleted: false},
        attributes: ['id'],
        raw: true,
        transaction,
    });
    for (const id of targets) {
        if (!users.some((user) => user.id === id)) {
            throw new TranslatableError('errors.rest.reviewerNotFound', {id});
        }
    }
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

/**
 * Handle all study sessions through websocket
 *
 * Loading the study sessions through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 * @class StudySessionSocket
 */
class StudySessionSocket extends Socket {

    /**
     * Send all study sessions to the client
     * If the user has access, it emits a 'study_sessionRefresh' event with the session data.
     * If access is denied, it sends a toast notification to the client with an error message.
     * 
     * @param studyId The ID of the study whose sessions are to be fetched and sent.
     * @return {Promise<void>} A promise that resolves (with no value) once the sessions have been sent or the access-denied notification has been sent.
     */
    async sendSessionsByStudyId(studyId) {
        const study = await this.models['study'].getById(studyId);
        if (await this.checkUserAccess(study.userId)) {
            this.emit("study_sessionRefresh", await this.models['study_session'].getAllByKey("studyId", studyId));
        } else {
            this.sendToast("errors.studies.notAllowedToSeeStudy", "errors.studies.errorTitle", "Danger");
        }
    }

    /**
     * Start a study session by either updating the start time of an existing session or creating a new one.
     * 
     * @socketEvent studySessionStart
     * @param {object} data The data required to start the session.
     * @param {number} data.studyId The ID of the study to create a new session for. Required if `studySessionId` is not provided.
     * @param {number} data.studySessionId The ID of an existing study session to update. If omitted, a new session is created.
     * @param {object} options  Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<void>} A promise that resolves with the newly created or updated study session object from the database.
     */
    async startStudySession(data, options) {
        let session;
        let shouldSendSessionStartEmail = false;
        if (data.studySessionId && data.studySessionId !== 0) {
            await this.assertWriteAccess("study_session", data.studySessionId, options);
            const existing = await this.models["study_session"].getById(data.studySessionId, {transaction: options.transaction});
            if (!existing) {
                throw new TranslatableError("errors.studies.studySession.notFound");
            }
            shouldSendSessionStartEmail = existing.start == null;
            session = await this.models["study_session"].updateById(data.studySessionId,
                {start: Date.now()},
                {transaction: options.transaction}
            );
        } else if (data.studyId) {
            session = await this.models["study_session"].add({
                studyId: data.studyId, userId: this.userId, start: Date.now()
            }, {transaction: options.transaction});
            shouldSendSessionStartEmail = true;
        }

        if (session && shouldSendSessionStartEmail) {
            options.transaction.afterCommit(async () => {
                try {
                    await this.sendSessionStartEmail(session);
                } catch (error) {
                    this.server.logger.error(`Failed to send session start email:`, error);
                }
            });
        }

        return session;
    }

    /**
     * Send session start email using configured template or fallback
     * @param {Object} studySession - Study session object
     * @returns {Promise<void>}
     */
    async sendSessionStartEmail(studySession) {
        const session = await this.models['study_session'].getById(studySession.id);
        if (!session || session.deleted || session.start == null) {
            return;
        }
        const study = await this.models['study'].getById(session.studyId);
        if (!study) return;

        if (!study.enableEmailNotifications) {
            return;
        }

        // Get submission owner email (study.userId)
        const user = await this.models['user'].getById(study.userId);
        if (!user || !user.email) {
            this.server.logger.warn(`Cannot send session start email: user ${study.userId} has no email`);
            return;
        }

        const baseUrl = await this.models["setting"].get("system.baseUrl") || "localhost:3000";
        const emailContent = await getEmailContent(
            "email.template.sessionStart",
            "sessionStart",
            {
                userId: study.userId,
                creatorId: study.userId,
                studyId: study.id,
                studySessionId: session.id,
                studySessionHash: session.hash,
                baseUrl: baseUrl
            },
            this.models,
            this.logger
        );
        await this.server.sendMail(user.email, emailContent.subject, emailContent.body, { isHtml: emailContent.isHtml });
    }

    /**
     * Send session finish email using configured template or fallback
     * @param {Object} studySession - Study session object
     * @returns {Promise<void>}
     */
    async sendSessionFinishEmail(studySession) {
        const study = await this.models['study'].getById(studySession.studyId);
        if (!study) return;

        if (study.closed) {
            return;
        }

        if (!study.enableEmailNotifications) {
            return;
        }

        // Get submission owner email (study.userId)
        const user = await this.models['user'].getById(study.userId);
        if (!user || !user.email) {
            this.server.logger.warn(`Cannot send session finish email: user ${study.userId} has no email`);
            return;
        }

        // Get baseUrl from settings
        const baseUrl = await this.models["setting"].get("system.baseUrl") || "localhost:3000";
        const reviewLink = `http://${baseUrl}/review/${studySession.hash}`;

        // Get email content from template or fallback
        const emailContent = await getEmailContent(
            "email.template.sessionFinish",
            "sessionFinish",
            {
                userId: study.userId,
                creatorId: study.userId,
                studyId: study.id,
                studySessionId: studySession.id,
                studySessionHash: studySession.hash,
                baseUrl: baseUrl,
                reviewLink
            },
            this.models,
            this.logger
        );

        // Send email
        await this.server.sendMail(user.email, emailContent.subject, emailContent.body, { isHtml: emailContent.isHtml });
    }

    /**
     * Finish a study session by setting its end date.
     * Validates that the session exists, has not already ended, and that the study is not closed.
     * Sends a session finish email after the transaction commits.
     *
     * @socketEvent studySessionFinish
     * @param {object} data The data required to finish the session.
     * @param {number} data.studySessionId The ID of the study session to finish.
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<Object>} The updated study session object.
     */
    async finishStudySession(data, options) {
        if (!data.studySessionId) {
            throw new TranslatableError("errors.studies.studySession.idRequired");
        }

        await this.assertWriteAccess("study_session", data.studySessionId, options);
        const session = await this.models["study_session"].getById(data.studySessionId, {transaction: options.transaction});
        if (!session) {
            throw new TranslatableError("errors.studies.studySession.notFound");
        }

        if (session.end) {
            throw new TranslatableError("errors.studies.studySession.alreadyFinished");
        }

        const study = await this.models["study"].getById(session.studyId, {transaction: options.transaction});
        if (study && study.closed) {
            throw new TranslatableError("errors.studies.studySession.cannotFinishClosedStudy");
        }

        const updatedSession = await this.models["study_session"].updateById(
            data.studySessionId,
            {end: Date.now()},
            {transaction: options.transaction}
        );

        // Send session finish email after transaction commits
        options.transaction.afterCommit(async () => {
            try {
                await this.sendSessionFinishEmail(updatedSession);
            } catch (error) {
                this.server.logger.error(`Failed to send session finish email:`, error);
            }
        });

        return updatedSession;
    }

    /**
     * Unsubscribes the client's socket from a study-specific communication channel.
     * This stops the client from receiving real-time events for that study.
     *
     * @socketEvent studySessionUnsubscribe
     * @param {object} data The data object containing the study identifier.
     * @param {number} data.studyId The study id
     * @param {object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} This function does not return a value.
     */
    unsubscribeFromStudySession(data, options) {
        this.socket.leave("study:" + data.studyId);
    }

    /**
     * Subscribes the client to a study-specific communication channel and sends the initial list of sessions.
     * This allows the client to receive real-time events for the study and get the current state.
     *
     * @socketEvent studySessionSubscribe
     * @param {object} data The data object containing the study identifier.
     * @param {number} data.studyId The ID of the study to subscribe to.
     * @param {object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the client has subscribed and the initial session data has been sent.
     */
    async subscribeToStudySession(data, options) {
        this.socket.join("study:" + data.studyId);
        await this.sendSessionsByStudyId(data.studyId);
    }

    /**
     * Duplicates a study session and assigns to user.
     * This is used to copy a study session for a user when they want to start a new session with the same data.
     * 
     * @socketEvent studySessionCopy
     * @param {object} data The data object containing the study session information and target user IDs.
     * @param {number} data.studySession.id The ID of the study session to be duplicated.
     * @param {number[]} data.userIds An array of user IDs to assign the duplicated session to.
     * @param {object} options  Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<StudySessions[]>} A promise that resolves with an array of the newly created study session objects for each target user.
     * @throws {TranslatableError} notFound if the study session does not exist.
     * @throws {TranslatableError} ACCESS_DENIED if the user cannot write to the session's study.
     */
    async copyStudySession(data, options) {
        let studySessions = [];
        // Load the session from the DB instead of trusting studyId from the payload
        const sourceSession = await this.models["study_session"].getById(data.studySession.id, {transaction: options.transaction});
        if (!sourceSession) {
            throw new TranslatableError("errors.studies.studySession.notFound");
        }
        const study = await this.models['study'].getById(sourceSession.studyId, {transaction: options.transaction});
        await this.assertWriteAccess("study", sourceSession.studyId, options);
        if (study.limitSessionsPerUser !== null) {
            await this.models["study"].updateById(study.id, {
                limitSessionsPerUser: study.limitSessionsPerUser + 1 // we only add 1 because there is a list of unique userIds, so the limit of session per user will only ever increase by one.
            }, {transaction: options.transaction});
        }   
         if (study.limitSessions !== null) {
            await this.models["study"].updateById(study.id, {
                limitSessions: study.limitSessions + data.userIds.length // we add the length of userIds because we are creating a session for each userId, so the limit of session per user will increase by the number of userIds.
            }, {transaction: options.transaction});
        }   


        for (const userId of data.userIds){
            studySessions.push(await this.models["study_session"].duplicateStudySession(data.studySession.id, {userId: userId}, options));
        }
        return studySessions;
    }

    async init() {
        this.createSocket("studySessionSubscribe", this.subscribeToStudySession, {}, false)
        this.createSocket("studySessionUnsubscribe", this.unsubscribeFromStudySession, {}, false);
        this.createSocket("studySessionStart", this.startStudySession, {}, true);
        this.createSocket("studySessionFinish", this.finishStudySession, {}, true);
        this.createSocket("studySessionCopy", this.copyStudySession, {}, true);
    }
}

module.exports = StudySessionSocket;
module.exports.listStudySessions = listStudySessions;
module.exports.getStudySession = getStudySession;
module.exports.startStudySession = startStudySession;
module.exports.finishStudySession = finishStudySession;
module.exports.copyStudySession = copyStudySession;
module.exports.deleteStudySession = deleteStudySession;
