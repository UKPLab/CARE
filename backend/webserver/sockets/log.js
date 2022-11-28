/* Handle logs through websocket

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

const Socket = require("../Socket.js");

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