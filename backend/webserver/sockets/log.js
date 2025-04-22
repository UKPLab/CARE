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
     * @param data - The data to log
     * @param data.level - The log level
     * @param data.message - The log message
     * @param data.metadata - Optional log message metadata
     * @param options - Unused
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
        this.createSocket("log", this.log, {}, false);

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