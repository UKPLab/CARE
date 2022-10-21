/* Handle user through websocket

Loading tags and tagSets through websocket

Author: Nils Dycke (dycke@ukp...)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/review");
const {
    getAll, minimalFields
} = require("../../db/methods/user.js");
const {loadByUser: loadDocs} = require("../../db/methods/document");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {
        socket.on("getAllUserData", async (data) => {
            console.log("GETTING ALL USER DATA");

            if (socket.request.session.passport.user.sysrole === "admin") {
                try {
                    const users = await getAll();
                    const mappedUsers = users.map(x => minimalFields(x));

                    socket.emit("userDataAll", {success: true, users: mappedUsers});
                } catch (e) {
                    socket.emit("userDataAll", {success: false, message: "Failed to retrieve all users"});
                    logger.error("DB error while loading all users from database" + JSON.stringify(data), {user: socket.request.session.passport.user.id})
                }
            } else {
                socket.emit("userDataAll", {success: false, message: "User rights and argument mismatch"});
                logger.error("User right and request parameter mismatch" + JSON.stringify(data), {user: socket.request.session.passport.user.id});
            }
        });
    });
}