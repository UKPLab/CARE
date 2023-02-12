const Socket = require("../Socket.js");

/**
 * Handle logs through websocket
 *
 * @author Dennis Zyska
 * @type {LoggerSocket}
 */
module.exports = class LoggerSocket extends Socket {

    init() {

        this.socket.on("logAdd", (data) => {
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

        this.socket.on("logGetAll", async (data) => {
            try {
                if (this.isAdmin()) {
                    this.socket.emit("logAll", await this.models['log'].getLogs(data['limit']));
                }
            } catch (err) {
                this.logger.error(err);
            }
        });


    }
}