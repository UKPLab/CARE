/* Handle user through websocket

Loading user data
Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: --
*/
const {
    getAll: dbGetAllUser, minimalFields
} = require("../../db/methods/user.js");
const Socket = require("../Socket.js");

module.exports = class UserSocket extends Socket {

    init() {
        this.socket.on("getAllUserData", async (data) => {
            console.log("GETTING ALL USER DATA");

            if (this.isAdmin()) {
                try {
                    const users = await dbGetAllUser();
                    const mappedUsers = users.map(x => minimalFields(x));

                    this.socket.emit("userDataAll", {success: true, users: mappedUsers});
                } catch (e) {
                    this.socket.emit("userDataAll", {success: false, message: "Failed to retrieve all users"});
                    this.logger.error("DB error while loading all users from database" + JSON.stringify(data));
                }
            } else {
                this.socket.emit("userDataAll", {success: false, message: "User rights and argument mismatch"});
                this.logger.error("User right and request parameter mismatch" + JSON.stringify(data));
            }
        });
    }
}