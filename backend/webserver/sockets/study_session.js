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
     * @returns {Promise<void>}
     */
    async sendSessions() {
        if (this.isAdmin()) {
            this.emit("studySessionRefresh", await this.models['study_session'].getAll());
        } else {
            const studies = await this.models['study'].getAllByKey('userId', this.userId);
            const sessionsPerStudy = await Promise.all(studies.map(async s => await this.models['study_session'].getAllByKey("studyId", s.id)))
            this.emit("studySessionRefresh", sessionsPerStudy.flat(1));
        }
    }

    /**
     * Update a study session
     * @param {number} sessionId
     * @param {object} data
     */
    async updateSession(sessionId, data) {
        if (data.evaluation) {
            const evaluatedStudySession = {
                evaluation: data.evaluation, reviewUserId: this.userId, reviewComment: data.reviewComment
            }
            this.emit("studySessionRefresh", await this.models['study_session'].updateById(data.sessionId, evaluatedStudySession))
        } else {
            const currentStudySession = await this.models['study_session'].getById(sessionId)
            const study = await this.models['study'].getById(currentStudySession.studyId);
            if (this.checkUserAccess(currentStudySession.userId) || this.checkUserAccess(study.userId)) {
                this.emit("studySessionRefresh", await this.models['study_session'].updateById(data.sessionId, data))
            } else {
                this.sendToast("You are not allowed to update this study session", "Error", "Danger");
            }
        }
    }

    /**
     * Send a study session by hash
     * @param {string} studySessionHash
     * @returns {Promise<void>}
     */
    async sendSessionGetByHash(studySessionHash) {
        const session = await this.models['study_session'].getByHash(studySessionHash);
        if (session) {
            const study = await this.models['study'].getById(session.studyId);
            if (this.checkUserAccess(session.userId) || this.checkUserAccess(study.userId)) {
                this.emit("studyRefresh", study);
                this.emit("studySessionRefresh", session);
            } else {
                this.socket.emit("studySessionError", {
                    studySessionHash: studySessionHash, message: "No access rights"
                });
            }
        } else {
            this.socket.emit("studySessionError", {
                studySessionHash: studySessionHash, message: "Not found"
            });
        }
    }

    /**
     * Add a study session
     * @param {object} data
     */
    async addSession(data) {
        data.userId = this.userId;
        this.emit("studySessionRefresh", await this.models['study_session'].add(data));
    }

    async init() {

        this.socket.on("studySessionGet", async (data) => {
            try {
                this.emit("studySessionRefresh", await this.models['study_session'].getAllByKey('userId', this.userId));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionGetAll", async (data) => {
            try {
                await this.sendSessions();
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionUpdate", async (data) => {
            try {
                if (data.sessionId && data.sessionId !== 0) {
                    await this.updateSession(data.sessionId, data);
                } else {
                    await this.addSession(data);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

        this.socket.on("studySessionGetByHash", async (data) => {
            try {
                await this.sendSessionGetByHash(data.studySessionHash)
            } catch (err) {
                this.socket.emit("studySessionError", {studySessionHash: data.studySessionHash, message: err});
                this.logger.error(err);
            }
        });

    }
}