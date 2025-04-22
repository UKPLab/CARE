const Socket = require("../Socket.js");

/**
 * Handle all study sessions through websocket
 *
 * Loading the study sessions through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 */
module.exports = class StudySessionSocket extends Socket {

    /**
     * Send all study sessions to the client
     *
     * @param studyId
     * @return {Promise<void>}
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
     * Start a study session
     * @param {object} data
     * @param {number} data.studyId - A study id
     * @param {number} data.studySessionId - A study session id
     * @param {object} options - Transaction options
     * @returns {Promise<void>}
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
     * Unsubscribe from a study session
     *
     * @param {object} data
     * @param {number} data.studyId - A study id
     * @param {object} options - Transaction options
     * @returns {Promise<void>}
     */
    unsubscribeFromStudySession(data, options) {
        this.socket.leave("study:" + data.studyId);
    }

    /**
     * Subscribe to a study session
     *
     * @param {object} data
     * @param {number} data.studyId - A study id
     * @param {object} options - Transaction options
     * @returns {Promise<void>}
     */
    async subscribeToStudySession(data, options) {
        this.socket.join("study:" + data.studyId);
        await this.sendSessionsByStudyId(data.studyId);
    }

    async init() {
        this.createSocket("studySessionSubscribe", this.subscribeToStudySession, {}, false)
        this.createSocket("studySessionUnsubscribe", this.unsubscribeFromStudySession, {}, false);
        this.createSocket("studySessionStart", this.startStudySession, {}, true);
    }
}