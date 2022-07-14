const logger = require("../../utils/logger.js")("sockets/log");

exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        const new_logger = logger.child({user: socket.request.session.passport.user.id})

        socket.on("log", (data) => {
            if (process.env.LOGGING_ALLOW_FRONTEND === 'true') {
                try {
                    if (data.meta) {
                        new_logger.log(data.level, data.message, data.meta);
                    } else {
                        new_logger.log(data.level, data.message);
                    }
                } catch (e) {
                    new_logger.error("Can't log message: " + JSON.stringify(data));
                }
            }
        });
    });
}