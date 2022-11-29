const Socket = require("../Socket.js");

/**
 * Handle logs through websocket
 *
 * @author Dennis Zyska
 * @type {LoggerSocket}
 */
module.exports = class LoggerSocket extends Socket {
    init() {

        this.socket.on("log", (data) => {
            if (process.env.LOGGING_ALLOW_FRONTEND === 'true') {
                try {
                    if (data.meta) {
                        this.logger.log(data.level, data.message, data.meta);
                    } else {
                        this.logger.log(data.level, data.message);
                    }
                } catch (e) {
                    this.logger.error("Can't log message: " + JSON.stringify(data));
                }
            }
        });

    }
}