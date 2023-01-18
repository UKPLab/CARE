const {add: dbAddStat, getByUser: getByUser, getAll: getAll} = require("../../db/methods/statistic.js");

const Socket = require("../Socket.js");
const {getAll: dbGetAllUser, adminFields} = require("../../db/methods/user");

/**
 * Add statistics about the website usage
 *
 * Therefore, use in frontend:
 *
 * this.$socket.emit("stats", {action: "action", data: {}});
 *
 * The data object can hold additional information!
 *
 * @author: Dennis Zyska, Nils Dycke
 * @type {StatisticSocket}
 */
module.exports = class StatisticSocket extends Socket {
    init() {
        this.socket.on("stats", async (data) => {
            try {

                //TODO the field acccept_stats is always null, so we can't check it here
                //if (socket.request.session.passport.user.accept_stats) {
                await dbAddStat(data.action, data.data, this.user_id);
                //}
            } catch (e) {
                this.logger.error("Can't add statistics: " + JSON.stringify(data) + " due to error " + e.toString());
            }
        });

        this.socket.on("statsGetByUser", async (data) => {
             if (this.isAdmin()) {
                try {
                    //TODO load only for those users with the stats flag set
                    const stats = await getByUser(data.userId);
                    this.socket.emit("statsByUser", {success: true, userId: data.userId, statistics: stats});
                } catch (e) {
                    this.socket.emit("statsByUser", {success: false, userId: data.userId, message: "Failed to retrieve stats for users"});
                    this.logger.error("Can't load statistics due to error " + e.toString());
                }
            } else {
                this.socket.emit("statsByUser", {success: false, userId: data.userId, message: "User rights and argument mismatch"});
                this.logger.error("User right and request parameter mismatch" + JSON.stringify(data));
            }
        });

        this.socket.on("statsGetAll", async (data) => {
             if (this.isAdmin()) {
                try {
                    //TODO load only for those users with the stats flag set
                    const stats = await getAll();
                    this.socket.emit("statsAll", {success: true, statistics: stats});
                } catch (e) {
                    this.socket.emit("statsAll", {success: false, message: "Failed to retrieve stats for all"});
                    this.logger.error("Can't load statistics due to error " + e.toString());
                }
            } else {
                this.socket.emit("statsAll", {success: false, message: "User rights and argument mismatch"});
                this.logger.error("User right and request parameter mismatch" + JSON.stringify(userIds));
            }
        });
    }
}