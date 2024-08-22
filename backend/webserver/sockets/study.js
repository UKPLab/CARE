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

            if (currentStudy.deleted && !study.deleted) {
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

        const newStudy = await this.models['study'].add(study);
        this.emit("studyRefresh", newStudy);

        return newStudy;
    }

    /**
     * Send all studies to the client
     * @param {number|null} userId if null, all studies will be sent (admin only)
     * @returns {Promise<*>}
     */
    async sendStudies(userId = null) {
        try {
            if (this.isAdmin()) {
                if (userId) {
                    this.emit("studyRefresh", await this.models['study'].getAllByKey('userId', userId));
                } else {
                    this.emit("studyRefresh", await this.models['study'].getAll());
                }
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
            const document = await this.models['document'].getById(study.documentId);  
            
            this.emit("study_sessionRefresh", sessions.filter(s => s.studyId === study.id));
            this.emit("studyRefresh", { ...study, documentType: document.type });  
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
     * Publish a study
     * @param {object} data
     * @return {Promise<void>}
     */
    async publishStudy(data) {
        const doc = await this.models['document'].getById(data.documentId);
        if (this.checkUserAccess(doc.userId)) {
            let study;
            if(data.id){
                study = await this.updateStudy(data.id, data);
            } else {
                study = await this.addStudy(data);
            }

            if (study) {
                this.socket.emit("studyPublished", {success: true, studyHash: study.hash});
            } else {
                this.socket.emit("studyPublished", {
                    success: false, message: "Error publishing study."
                });
            }
        } else {
            this.logger.error("No permission to publish study: " + data.documentId);
            this.socket.emit("studyPublished", {
                success: false, message: "No permission to publish study"
            });
        }
    }

    async init() {

        this.socket.on("studyGet", async (data) => {
            try {
                await this.sendStudy(data.studyId);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetAll", async (data) => {
            try {
                await this.sendStudies((data && data.userId) ? data.userId : null);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetByHash", async (data) => {
            try {
                await this.sendStudyByHash(data.studyHash);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyUpdate", async (data) => {
            try {
                if (data.studyId && data.studyId !== 0) {
                    await this.updateStudy(data.studyId, data);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

        this.socket.on("studyPublish", async (data) => {
            try {
                await this.publishStudy(data)
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("studyPublished", {
                    success: false, message: "Error while publishing study"
                });

            }
        });

    }
}