const Socket = require("../Socket.js");
const {dbGetDoc, dbUpdateDoc} = require("../../db/methods/document");
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
            if (data.studyId && data.studyId !== 0) {
                const currentStudy = await this.models['study'].getById(data.studyId)
                if (this.isAdmin() || currentStudy.userId === this.user_id) {
                    const study = await this.updateCreatorName(await this.models['study'].updateById(data.studyId, data));
                    this.socket.emit("studyRefresh", study)
                    return study;
                } else {
                    this.sendToast("You are not allowed to update this study", "Error", "Danger");
                }
            } else {
                data.userId = this.user_id;
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

        this.socket.on("studyGet", async (data) => {
            try {
                this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAllByUserId(this.user_id)));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetByHash", async (data) => {
            try {
                this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getByHash(data.studyHash)));
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

        this.socket.on("studyPublish", async (data) => {
            try {
                const doc = await dbGetDoc(data.documentId);
                if (this.checkUserAccess(doc.userId)) {
                    const study = await this.updateStudy(data);
                    if (study) {
                        this.socket.emit("studyPublished", {success: true, hash: study[0].hash});
                    } else {
                        this.socket.emit("studyPublished", {
                            success: false,
                            message: "Error publishing study."
                        });
                    }
                } else {
                    this.logger.error("No permission to publish document: " + data.documentId);
                    this.socket.emit("studyPublished", {
                        success: false,
                        message: "No permission to publish study"
                    });
                }
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("documentPublished", {
                    success: false,
                    message: "Error while publishing document"
                });

            }
        });

        this.socket.on("studySessionGet", async (data) => {
            try {
                this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].getAllByUserId(this.user_id)));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionGetAll", async (data) => {
            try {
                if (this.isAdmin()) {
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study'].getAll()));
                } else {
                    this.sendToast("You don't have access to all study sessions", "Error", "danger");
                    this.logger.error("User requested access to all study sessions without rights");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studySessionUpdate", async (data) => {
            try {
                if (data.studySessionId && data.studySessionId !== 0) {
                    const currentStudySession = await this.models['study_session'].getById(data.studySessionId)
                    if (this.isAdmin() || currentStudySession.userId === this.user_id) {
                        this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].updateById(data.studySessionId, data)))
                    } else {
                        this.sendToast("You are not allowed to update this study session", "Error", "Danger");
                    }
                } else {
                    data.userId = this.user_id;
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].add(data)))
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

    }
}