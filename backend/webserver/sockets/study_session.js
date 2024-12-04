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
        if (await this.isAdmin()) {
            if (userId) {
                const studies = await this.models['study'].getAllByKey('userId', userId);
                const sessionsPerStudy = await Promise.all(studies.map(async s => await this.models['study_session'].getAllByKey("studyId", s.id)))
                this.emit("study_sessionRefresh", sessionsPerStudy.flat(1));
            } else {
                this.emit("study_sessionRefresh", await this.models['study_session'].getAll());
            }
        } else {
            const userStudySessions = await this.models["study_session"].getAllByKey("userId", this.userId);
            const studyIds = [...new Set(userStudySessions.map(s => s.studyId))];

            // get studies (to verify they exist still)
            let studies = await Promise.all(studyIds.map(async sid => await this.models["study"].getById(sid)));
            studies = studies.filter(s => s !== null && s !== undefined)

            const sessionsPerStudy = studies.map(study => userStudySessions.filter(session => session.studyId === study.id));
            this.emit("study_sessionRefresh", sessionsPerStudy.flat(1));
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
            this.emit("study_sessionRefresh", await this.models['study_session'].getAllByKey("studyId", studyId));
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
        try {
            if (data.evaluation) {
                const evaluatedStudySession = {
                    evaluation: data.evaluation, reviewUserId: this.userId, reviewComment: data.reviewComment
                }
                const studySession = await this.models['study_session'].updateById(data.sessionId, evaluatedStudySession)
                await this.emitRoom("study:" + studySession.studyId, "study_sessionRefresh", studySession);
            } else {
                const currentStudySession = await this.models['study_session'].getById(sessionId)
                const study = await this.models['study'].getById(currentStudySession.studyId);
                if (this.checkUserAccess(currentStudySession.userId) || this.checkUserAccess(study.userId)) {
                    const studySession = await this.models['study_session'].updateById(data.sessionId, data);
                    await this.emitRoom("study:" + studySession.studyId, "study_sessionRefresh", studySession);
                } else {
                    this.sendToast("You are not allowed to update this study session", "Error", "Danger");
                }
            }
        } catch (err) {
            throw new Error(err.message);
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
            //CHeck User Access prüfen
            //Ändern: Returnen ob Zugriff oder nicht
            if (await this.checkUserAccess(session.userId) || await this.checkUserAccess(study.userId)) {
                this.emit("studyRefresh", study);
                this.emit("study_sessionRefresh", session);
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
     * @param {object} data
     * @param {number} data.studyId - A study id
     * @param {number} data.studySessionId - A study session id
     * @param {object} options - Transaction options
     * @returns {Promise<void>}
     */
    async startStudySession(data, options) {
        if (data.studySessionId && data.studySessionId !== 0) {
            // we just start the session
            return await this.models["study_session"].updateById(data.studySessionId, {start: Date.now()}, {transaction: options.transaction});
        } else if (data.studyId) {
            // we create a new session
            return await this.models["study_session"].add({
                studyId: data.studyId, userId: this.userId, start: Date.now()
            }, {transaction: options.transaction});
        }

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
                        this.emit("study_sessionRefresh", await this.models['study_session'].getAllByKey("studyId", data.studyId));
                    } else {
                        this.sendToast("You are not allowed to see this study", "Error", "Danger");
                    }
                } else {
                    this.emit("study_sessionRefresh", await this.models['study_session'].getById(data.studySessionId));
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
                this.logger.error(err.message);
                this.sendToast(err.message, "Error updating study", "danger");
            }
        });

        this.createSocket("studySessionStart", this.startStudySession, {}, true);

        this.socket.on("studySessionGetByHash", async (data, callback) => {
            try {
                //Callback mit Zugriff ja oder nein (retunren)
                await this.sendSessionGetByHash(data.studySessionHash)
            } catch (err) {
                this.socket.emit("studySessionError", {studySessionHash: data.studySessionHash, message: err});
                this.logger.error(err);
            }
        });

    }
}