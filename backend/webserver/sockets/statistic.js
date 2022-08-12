/* Add statistics about the website usage

Therefore, use in frontend:

this.$socket.emit("stats", {action: "action", data: {}});

The data object can hold additional information!

 */

const logger = require("../../utils/logger.js")("sockets/statistic");
const {add} = require("../../db/methods/statistic.js");


exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        socket.on("stats", async (data) => {
            try {

                //TODO the field acccept_stats is always null, so we can't check it here
                //console.log(socket.request.session.passport.user);

                //if (socket.request.session.passport.user.accept_stats) {
                    await add(data.action, data.data, socket.request.session.passport.user.id);
                //}
            } catch (e) {
                logger.error("Can't add statistics: " + JSON.stringify(data), {user: socket.request.session.passport.user.id});
            }

        });
    });

}