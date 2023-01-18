const {
    getAll: dbGetAllUser,
    getUsername: dbGetUsername,
    minimalFields
} = require("../../db/methods/user.js");
const Socket = require("../Socket.js");

/**
 * Handle user through websocket
 *
 * @author Nils Dycke, Dennis Zyska
 * @type {UserSocket}
 */
module.exports = class UserSocket extends Socket {

    /**
     * Add username as creator_name of an database entry with column creator
     *
     * Accept data as list of objects or single object
     * Note: returns always list of objects!
     *
     * @param data
     * @returns {Promise<Awaited<*&{creator_name: string|*|undefined}>[]>}
     */
    async updateCreatorName(data) {
        if (!Array.isArray(data)) {
            data = [data];
        }

        return Promise.all(data.map(async x => {
            return {...x, creator_name: await dbGetUsername(x.userId)};
        }));
    }

    init() {

        this.socket.on("userGetData", async (data) => {

            if (this.isAdmin()) {
                try {
                    const users = await dbGetAllUser();
                    const mappedUsers = users.map(x => minimalFields(x));

                    this.socket.emit("userData", {success: true, users: mappedUsers});
                } catch (e) {
                    this.socket.emit("userData", {success: false, message: "Failed to retrieve all users"});
                    this.logger.error("DB error while loading all users from database" + JSON.stringify(e));
                }
            } else {
                this.socket.emit("userData", {success: false, message: "User rights and argument mismatch"});
                this.logger.error("User right and request parameter mismatch" + JSON.stringify(e));
            }
        });

    }
}