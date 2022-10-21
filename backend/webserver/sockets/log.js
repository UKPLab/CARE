/* Handle logs through websocket

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/log");

exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        socket.on("log", (data) => {
            if (process.env.LOGGING_ALLOW_FRONTEND === 'true') {
                try {
                    if (data.meta) {
                        logger.log(data.level, data.message, data.meta);
                    } else {
                        logger.log(data.level, data.message);
                    }
                } catch (e) {
                    logger.error("Can't log message: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
                }
            }
        });
    });
}