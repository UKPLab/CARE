const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/emailHelper");

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
        if (this.checkUserAccess(study.userId)) {
            this.emit("study_sessionRefresh", await this.models['study_session'].getAllByKey("studyId", studyId));
        } else {
            this.sendToast("You are not allowed to see this study", "Error", "Danger");
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
            const existing = await this.models["study_session"].getById(data.studySessionId, {transaction: options.transaction});
            if (!existing) {
                throw new Error("Study session not found");
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
            throw new Error("studySessionId is required");
        }

        const session = await this.models["study_session"].getById(data.studySessionId, {transaction: options.transaction});
        if (!session) {
            throw new Error("Study session not found");
        }

        if (session.end) {
            throw new Error("Study session has already been finished");
        }

        const study = await this.models["study"].getById(session.studyId, {transaction: options.transaction});
        if (study && study.closed) {
            throw new Error("Cannot finish session: The study has been closed. Sessions are automatically terminated when a study is closed.");
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

    async init() {
        this.createSocket("studySessionSubscribe", this.subscribeToStudySession, {}, false)
        this.createSocket("studySessionUnsubscribe", this.unsubscribeFromStudySession, {}, false);
        this.createSocket("studySessionStart", this.startStudySession, {}, true);
        this.createSocket("studySessionFinish", this.finishStudySession, {}, true);
    }
}

module.exports = StudySessionSocket;