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


    async init() {

        this.socket.on("studyGet", async (data) => {
            try {
                this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAllByUserId(this.user_id)));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetAll", async (data) => {
            try {
                if (this.isAdmin()) {
                    this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAll()));
                } else {
                    this.sendToast("You don't have access to all studies", "Error", "danger");
                    this.logger.error("User requested access to all studies without rights");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyUpdate", async (data) => {
            try {
                if (data.studyId && data.studyId !== 0) {
                    const currentStudy = await this.models['study'].getById(data.studyId)
                    if (this.isAdmin() || currentStudy.userId === this.user_id()) {
                        this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].updateById(data.studyId, data)))
                    } else {
                        this.sendToast("You are not allowed to update this study", "Error", "Danger");
                    }
                } else {
                    this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].add(data)))
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
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
                    if (this.isAdmin() || currentStudySession.userId === this.user_id()) {
                        this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].updateById(data.studySessionId, data)))
                    } else {
                        this.sendToast("You are not allowed to update this study session", "Error", "Danger");
                    }
                } else {
                    this.socket.emit("studySessionRefresh", await this.updateCreatorName(await this.models['study_session'].add(data)))
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating study", "Danger");
            }
        });

    }
}