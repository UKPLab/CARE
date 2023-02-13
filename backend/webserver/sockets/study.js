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

    /**
     * Update study
     * @param {number} studyId
     * @param {object} data study object
     * @returns {Promise<*>}
     */
    async updateStudy(studyId, data) {

        const currentStudy = await this.models['study'].getById(studyId);
        if (this.checkUserAccess(currentStudy.userId)) {
            const study = await this.models['study'].updateById(studyId, data);

            if (study.deleted) {
                const sessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                for (const session of sessions) {
                    await this.models['study_session'].deleteById(session.id);
                }
            }

            this.emit("studyRefresh", study)
            return study;
        } else {
            this.sendToast("You are not allowed to update this study", "Error", "Danger");
        }


    }

    /**
     * Add a new study
     * @param study
     * @returns {Promise<void>}
     */
    async addStudy(study) {
        study.userId = this.userId;
        this.emit("studyRefresh", await this.models['study'].add(study));
    }

    /**
     * Send all studies to the client
     * @returns {Promise<*>}
     */
    async sendStudies() {
        try {
            if (this.isAdmin()) {
                this.emit("studyRefresh", await this.models['study'].getAll());
            } else {
                this.emit("studyRefresh", await this.models['study'].getAllByKey('userId', this.userId));
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Send a study by hash
     * @param {string} studyHash
     * @returns {Promise<void>}
     */
    async sendStudyByHash(studyHash) {
        const study = await this.models['study'].getByHash(studyHash);
        if (study) {
            const sessions = await this.models['study_session'].getAllByKey('userId', this.userId);
            this.emit("studySessionRefresh", sessions.filter(s => s.studyId === study.id), false);
            this.emit("studyRefresh", study);
        } else {
            this.socket.emit("studyError", {
                studyHash: studyHash, message: "Not found!"
            });
        }
    }

    /**
     * Send a study by id
     * @param {number} studyId
     * @returns {Promise<void>}
     */
    async sendStudy(studyId) {
        const study = await this.models['study'].getById(studyId);
        if (study) {
            this.emit("studyRefresh", study);
        } else {
            this.socket.emit("studyError", {
                studyHash: data.studyHash, message: "Not found!"
            });
        }
    }

    /**
     * Start a study
     * @param {number} studyId
     * @returns {Promise<void>}
     */
    async startStudy(studyId) {
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

        this.emit("studySessionRefresh", studySession);
        this.socket.emit("studyStarted", {success: true, studySessionId: studySession.id});
    }

    /**
     * Publish a study
     * @param {object} data
     * @return {Promise<void>}
     */
    async publishStudy(data) {
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
    }

    async init() {

        this.socket.on("studyGetAll", async (data) => {
            try {
                await this.sendStudies();
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyUpdate", async (data) => {
            try {
                if (data.studyId && data.studyId !== 0) {
                    await this.updateStudy(data.studyId, data);
                } else {
                    await this.addStudy(data);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

        this.socket.on("studyGetByHash", async (data) => {
            try {
                await this.sendStudyByHash(data.studyHash);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGet", async (data) => {
            try {
                await this.sendStudy(data.studyId);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyStart", async (data) => {
            try {
                await this.startStudy(data.studyId);
            } catch (err) {
                this.socket.emit("studyStarted", {success: false});
                this.logger.error(err);
            }
        });

        this.socket.on("studyPublish", async (data) => {
            try {
                await this.publishStudy(data)
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("studyPublished", {
                    success: false, message: "Error while publishing document"
                });

            }
        });

    }
}