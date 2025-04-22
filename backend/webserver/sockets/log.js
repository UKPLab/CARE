const Socket = require("../Socket.js");

/**
 * Handle logs through websocket
 *
 * @author Dennis Zyska
 * @type {LoggerSocket}
 */
module.exports = class LoggerSocket extends Socket {

    /**
     * Log a message
     *
     * @param data
     * @returns {void}
     */
    async log(data, options) {
        if (process.env.LOGGING_ALLOW_FRONTEND === 'true') {
            if (data.meta) {
                this.logger.log(data.level, data.message, data.meta);
            } else {
                this.logger.log(data.level, data.message);
            }
        }
    }

    init() {

        this.socket.on("log", (data) => {
            try {
                this.log(data);
            } catch (e) {
                this.logger.error("Can't log message: " + JSON.stringify(data));
            }

        });

        this.socket.on("logGetAll", async (data) => {
            try {
                if (await this.isAdmin()) {
                    this.socket.emit("logAll", await this.updateCreatorName(await this.models['log'].getLogs(data)));
                }
            } catch (err) {
                this.logger.error(err);
            }
        });


    }
}