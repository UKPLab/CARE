const Socket = require("../Socket.js");
const {dbGetDoc} = require("../../db/methods/document");
const {setUserSetting} = require("../../db/methods/settings");

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
                if(this.isAdmin())
                    this.socket.emit("studyRefresh", await this.updateCreatorName(await this.models['study'].getAll()));
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyUpdate", async (data) => {
        });

        this.socket.on("studySessionGet", async (data) => {
        });

        this.socket.on("studySessionUpdate", async (data) => {
        });

    }
}