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
     * @param {number} userId
     * @returns {Promise<void>}
     */
    async sendSessions(userId = null) {
        if (this.isAdmin()) {
            if (userId) {
                const studies = await this.models['study'].getAllByKey('userId', userId);
                const sessionsPerStudy = await Promise.all(studies.map(async s => await this.models['study_session'].getAllByKey("studyId", s.id)))
                this.emit("studySessionRefresh", sessionsPerStudy.flat(1));
            } else {
                this.emit("studySessionRefresh", await this.models['study_session'].getAll());
            }
        } else {
            const userStudySessions = await this.models["study_session"].getAllByKey("userId", this.userId);
            const studyIds = [...new Set(userStudySessions.map(s => s.studyId))];

            // get studies (to verify they exist still)
            let studies = await Promise.all(studyIds.map(async sid => await this.models["study"].getById(sid)));
            studies = studies.filter(s => s !== null && s !== undefined)

            const sessionsPerStudy = studies.map(study => userStudySessions.filter(session => session.studyId === study.id));
            this.emit("studySessionRefresh", sessionsPerStudy.flat(1));
        }
    }

    /**
     * Send all study sessions to the client
     *
     * @param studyId
     * @return {Promise<void>}
     */
    async sendSessionsByStudyId(studyId) {
        const study = await this.models['study'].getById(studyId);
        if (this.checkUserAccess(study.userId)) {
            this.emit("studySessionRefresh", await this.models['study_session'].getAllByKey("studyId", studyId));
        } else {
            this.sendToast("You are not allowed to see this study", "Error", "Danger");
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
            const studySession = await this.models['study_session'].updateById(data.sessionId, evaluatedStudySession)
            await this.emitRoom("study:" + studySession.studyId, "studySessionRefresh", studySession);
        } else {
            const currentStudySession = await this.models['study_session'].getById(sessionId)
            const study = await this.models['study'].getById(currentStudySession.studyId);
            if (this.checkUserAccess(currentStudySession.userId) || this.checkUserAccess(study.userId)) {
                const studySession = await this.models['study_session'].updateById(data.sessionId, data);
                await this.emitRoom("study:" + studySession.studyId, "studySessionRefresh", studySession);
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
     * Start a study session
     * @param {number} studyId
     * @returns {Promise<void>}
     */
    async startStudySession(studyId) {
        const study = await this.models['study'].getById(studyId);
        if (study.start !== null && new Date() < new Date(study.start)) {
            this.sendToast("Failed to start study, the study hasn't started yet.", "Study Failure", "danger");
            return;
        }
        if (study.end !== null && new Date(study.end) < new Date()) {
            this.sendToast("Failed to start study, the study already finished.", "Study Failure", "danger");
            return;
        }

        const studySession = await this.models["study_session"].add({
            studyId: study.id, userId: this.userId, start: Date.now()
        });

        await this.emitRoom("study:" + studySession.studyId, "studySessionRefresh", studySession);
        this.socket.emit("studySessionStarted", {success: true, studySessionId: studySession.id});
    }

    async init() {
        this.socket.on("studySessionSubscribe", async (data) => {
            try {
                this.socket.join("study:" + data.studyId);
                await this.sendSessionsByStudyId(data.studyId);
            } catch (err) {
                this.logger.error(err);
            }
        });
        this.socket.on("studySessionUnsubscribe", async (data) => {
            try {
                this.socket.leave("study:" + data.studyId);
            } catch (err) {
                this.logger.error(err);
            }
        });
        this.socket.on("studySessionGet", async (data) => {
            try {
                if (data.studyId) {
                    const study = await this.models['study'].getById(data.studyId);
                    if (this.checkUserAccess(study.userId)) {
                        this.emit("studySessionRefresh", await this.models['study_session'].getAllByKey("studyId", data.studyId));
                    } else {
                        this.sendToast("You are not allowed to see this study", "Error", "Danger");
                    }
                } else {
                    this.emit("studySessionRefresh", await this.models['study_session'].getById(data.studySessionId));
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionGetAll", async (data) => {
            try {
                await this.sendSessions((data.userId) ? data.userId : null);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionUpdate", async (data) => {
            try {
                if (data.sessionId && data.sessionId !== 0) {
                    await this.updateSession(data.sessionId, data);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

        this.socket.on("studySessionStart", async (data) => {
            try {
                await this.startStudySession(data.studyId);
            } catch (err) {
                this.socket.emit("studySessionStarted", {success: false});
                this.logger.error(err);
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