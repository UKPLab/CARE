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
     * Log a message received from the client, if frontend logging is enabled via environment variables
     *
     * @socketEvent log
     * @param {Object} data The log entry payload.
     * @param {string} data.level The log level (e.g., 'info', 'warn', 'error').
     * @param {string} data.message The primary message to be logged.
     * @param {Object} data.meta Optional metadata to include with the log entry.
     * @param {Object} options Additional configuration parameters.
     * @returns {Promise<void>} A promise that resolves (with no value) once the log attempt is complete.
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
     * Get log messages. This operation is restricted to users with administrator privileges.
     *
     * @socketEvent logGetAll
     * @param data The log entry selection criteria
     * @param data.filter An object defining filters for the log entries (e.g., by level or source).
     * @param data.order An array specifying the order of the results.
     * @param data.limit The maximum number of log entries to return.
     * @param data.page Log entry page
     * @param options Additional configuration parameters.
     * @returns Promise<void>} A promise that resolves (with no value) once the logs have been sent to the client, or immediately if the user is not an admin.
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