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

    /**
     * Send statistics to the user
     * @param {number} userId
     * @returns {Promise<void>}
     */
    async sendStatsByUser(userId) {
        if (this.isAdmin()) {
            if (this.models["user"].getById(userId).acceptStats) {
                const stats = await this.models['statistic'].getAllByKey('userId', userId);
                this.socket.emit("statsDataByUser", {success: true, userId: userId, statistics: stats});
            } else {
                this.socket.emit("statsDataByUser", {
                    success: false,
                    userId: userId,
                    message: "User rights and argument mismatch"
                });
                this.logger.error("User right and request parameter mismatch" + JSON.stringify(data));
            }

        }
    }

    /**
     * Send statistics to the user
     * @returns {Promise<void>}
     */
    async sendStats() {
        if (this.isAdmin()) {
            const stats = await this.models['statistic'].getAll();
            const filteredStats = stats.filter(stat => this.models["user"].getById(stat.userId).acceptStats);
            this.socket.emit("statsData", {success: true, statistics: filteredStats});
        } else {
            this.socket.emit("statsData", {success: false, message: "User rights and argument mismatch"});
            this.logger.error("User right and request parameter mismatch" + JSON.stringify(data));
        }
    }

    init() {

        this.socket.on("stats", async (data) => {
            try {
                if (this.user.acceptStats) {
                    await this.models["statistic"].add({
                        action: data.action,
                        data: JSON.stringify(data.data),
                        userId: this.userId,
                        timestamp: new Date(),
                    })
                }
            } catch (e) {
                this.logger.error("Can't add statistics: " + JSON.stringify(data) + " due to error " + e.toString());
            }
        });

        this.socket.on("statsGetByUser", async (data) => {
            try {
                await this.sendStatsByUser(data.userId);
            } catch (e) {
                this.socket.emit("statsData", {
                    success: false,
                    userId: data.userId,
                    message: "Failed to retrieve stats for users"
                });
                this.logger.error("Can't load statistics due to error " + e.toString());
            }

        });

        this.socket.on("statsGetAll", async (data) => {
            try {
                await this.sendStats();
            } catch (e) {
                this.socket.emit("statsData", {success: false, message: "Failed to retrieve stats for all"});
                this.logger.error("Can't load statistics due to error " + e.toString());
            }

        });
    }


}