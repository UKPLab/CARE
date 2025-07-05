const Socket = require("../Socket.js");

/**
 * Handle logs through websocket
 *
 * @author Dennis Zyska
 * @type {LoggerSocket}
 * @class LoggerSocket
 */
class LoggerSocket extends Socket {

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
    /**
     * Get log messages
     *
     * @param data - The log entry selection criteria
     * @param data.filter - Log entry filter
     * @param data.order - Log entry order
     * @param data.limit - Log entry limit
     * @param data.page - Log entry page
     * @param options - Unused
     * @returns {void}
     */
    async getAllLogs(data, options) {
        if (await this.isAdmin()) {
            this.socket.emit("logAll", await this.updateCreatorName(await this.models['log'].getLogs(data)));
        }
    }

    init() {
        this.createSocket("log", this.log, {}, false);
        this.createSocket("logGetAll", this.getAllLogs, {}, false);
    }
}

module.exports = LoggerSocket;