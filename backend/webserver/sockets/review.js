const logger = require("../../utils/logger.js")( "sockets/review");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("reviewSubmit", async (data) => {
            logger.info("Review submitted", {user: socket.request.session.passport.user.id})
            socket.emit("reviewSubmitted", {success: false});
        });
    });
}