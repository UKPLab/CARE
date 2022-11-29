const {add: dbAddStat} = require("../../db/methods/statistic.js");

const Socket = require("../Socket.js");

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
                //console.log(socket.request.session.passport.user);

                //if (socket.request.session.passport.user.accept_stats) {
                await dbAddStat(data.action, data.data, this.user_id);
                //}
            } catch (e) {
                this.logger.error("Can't add statistics: " + JSON.stringify(data));
            }
        });
    }
}