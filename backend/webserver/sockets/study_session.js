const Socket = require("../Socket.js");

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
        if (data.studySessionId && data.studySessionId !== 0) {
            // we just start the session
            return await this.models["study_session"].updateById(data.studySessionId,
                {start: Date.now()},
                {transaction: options.transaction}
            );
        } else if (data.studyId) {
            // we create a new session
            return await this.models["study_session"].add({
                studyId: data.studyId, userId: this.userId, start: Date.now()
            }, {transaction: options.transaction});
        }

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
     * @param {object} data.studySession The study session object to be duplicated.
     * @param {number[]} data.userIds An array of user IDs to assign the duplicated session to.
     * @param {object} options  Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<StudySessions[]>} A promise that resolves with an array of the newly created study session objects for each target user.
     */
    async copyStudySession(data, options) {
        let studySessions = [];
        const study = await this.models['study'].getById(data.studySession.studyId);
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
        this.createSocket("studySessionCopy", this.copyStudySession, {}, true);
    }
}

module.exports = StudySessionSocket;