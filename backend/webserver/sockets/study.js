const Socket = require("../Socket.js");

/**
 * Handle all studies through websocket
 *
 * Loading the studies through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 */
module.exports = class StudySocket extends Socket {

    async updateStudy(data) {
        try {
            if (data.id && data.id !== 0) {
                const currentStudy = await this.models['study'].getById(data.id);
                if (this.checkUserAccess(currentStudy.userId)) {
                    const study = await this.updateCreatorName(await this.models['study'].updateById(data.id, data));
                    this.socket.emit("studyRefresh", study)
                    return study;
                } else {
                    this.sendToast("You are not allowed to update this study", "Error", "Danger");
                }
            } else {
                data.userId = this.userId;
                const study = await this.updateCreatorName(await this.models['study'].add(data));
                this.socket.emit("studyRefresh", study);
                return study;
            }
        } catch (err) {
            this.logger.error(err);
            this.sendToast(err, "Error updating study", "Danger");
        }
    }


    async init() {
        this.socket.on("studyGetAll", async (data) => {
            try {
                this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAllByKey('userId', this.userId)));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyDelete", async (data) => {
            try {
                const study = await this.models['study'].getById(data.studyId);
                if (this.checkUserAccess(study.userId)) {
                    const sessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                    for (const session of sessions) {
                        await this.models['study_session'].deleteById(session.id);
                    }

                    this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].deleteById(data.studyId)));
                } else {
                    this.sendToast("You are not allowed to delete this study", "Error", "Danger");
                }

            } catch (err) {
                this.logger.error(err);
            }
        });


        this.socket.on("studyGetByHash", async (data) => {
            try {
                const study = await this.models['study'].getByHash(data.studyHash);
                if (study) {
                    const sessions = await this.models['study_session'].getAllByKey('userId', this.userId)
                    this.socket.emit("studySessionRefresh", sessions.filter(s => s.studyId === study.id))
                    this.socket.emit("studyRefresh", await this.updateCreatorName(study));
                } else {
                    this.socket.emit("studyError", {
                        studyHash: data.studyHash, message: "Not found!"
                    });
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetById", async (data) => {
            try {
                const study = await this.models['study'].getById(data.studyId);
                if (study) {
                    this.socket.emit("studyRefresh", await this.updateCreatorName(study));
                } else {
                    this.socket.emit("studyError", {
                        studyHash: data.studyHash, message: "Not found!"
                    });
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetAll", async (data) => {
            try {
                this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAll()));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyUpdate", async (data) => {
            await this.updateStudy(data);
        });

        this.socket.on("studyStart", async (data) => {
            try {
                const study = await this.models['study'].getById(data.studyId);
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

                this.socket.emit("studySessionRefresh", await this.updateCreatorName(studySession));
                this.socket.emit("studyStarted", {success: true, studySessionId: studySession.id});
            } catch (err) {
                this.socket.emit("studyStarted", {success: false});
                this.logger.error(err);
            }
        });

        this.socket.on("studyPublish", async (data) => {
            try {
                const doc = await this.models['document'].getById(data.documentId);
                if (this.checkUserAccess(doc.userId)) {
                    const study = await this.updateStudy(data);
                    if (study) {
                        this.socket.emit("studyPublished", {success: true, hash: study[0].hash});
                    } else {
                        this.socket.emit("studyPublished", {
                            success: false, message: "Error publishing study."
                        });
                    }
                } else {
                    this.logger.error("No permission to publish document: " + data.documentId);
                    this.socket.emit("studyPublished", {
                        success: false, message: "No permission to publish study"
                    });
                }
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("documentPublished", {
                    success: false, message: "Error while publishing document"
                });

            }
        });

        this.socket.on("studySessionGet", async (data) => {
            try {
                this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].getAllByKey('userId', this.userId)));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionGetAll", async (data) => {
            try {
                if (this.isAdmin()) {
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].getAll()));
                } else {
                    const studies = await this.models['study'].getAllByUserId(this.userId);
                    const sessionsPerStudy = await Promise.all(studies.map(async s => await this.models['study_session'].getAllByKey("studyId", s.id)))
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(sessionsPerStudy.flat(1)));
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionUpdate", async (data) => {
            try {
                if (data.sessionId && data.sessionId !== 0) {
                    if (data.evaluation) {
                        const evaluatedStudySession = {
                            evaluation: data.evaluation, reviewUserId: this.userId, reviewComment: data.reviewComment
                        }
                        this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].updateById(data.sessionId, evaluatedStudySession)))
                    } else {
                        const currentStudySession = await this.models['study_session'].getById(data.sessionId)
                        const study = await this.models['study'].getById(currentStudySession.studyId);
                        if (this.checkUserAccess(currentStudySession.userId) || this.checkUserAccess(study.userId)) {
                            this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].updateById(data.sessionId, data)))
                        } else {
                            this.sendToast("You are not allowed to update this study session", "Error", "Danger");
                        }
                    }
                } else {
                    data.userId = this.userId;
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].add(data)))
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

        this.socket.on("studySessionGetByHash", async (data) => {
            try {
                const session = await this.models['study_session'].getByHash(data.studySessionHash);
                if (session) {
                    const study = await this.models['study'].getById(session.studyId);
                    if (this.checkUserAccess(session.userId) || this.checkUserAccess(study.userId)) {
                        this.socket.emit("studyRefresh", study);
                        this.socket.emit("studySessionRefresh", session);
                    } else {
                        this.socket.emit("studySessionError", {
                            studySessionHash: data.studySessionHash, message: "No access rights"
                        });
                    }
                } else {
                    this.socket.emit("studySessionError", {
                        studySessionHash: data.studySessionHash, message: "Not found"
                    });
                }
            } catch (err) {
                this.socket.emit("studySessionError", {studySessionHash: data.studySessionHash, message: err});
                this.logger.error(err);
            }
        });

    }
}