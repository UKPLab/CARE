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
        if (await this.isAdmin()) {
            if ((await this.models["user"].getById(userId)).acceptStats) {
                const stats = await this.models['statistic'].getAllByKey('userId', userId);
                this.socket.emit("statsDataByUser", {success: true, userId: userId, statistics: stats});
            } else {
                this.socket.emit("statsDataByUser", {
                    success: false,
                    userId: userId,
                    message: "User rights and argument mismatch"
                });
                this.logger.error("User right and request parameter mismatch. User did not agree to stats collection.");
            }

        }
    }

    /**
     * Get statistics
     * @param {Object} data - The data object containing the userId
     * @param {Number} data.userId - The userId to get statistics for (optional)
     * @param {Object} options - not used
     *
     * @returns {Promise<Object>} - The statistics data
     *
     * @throws {Error} - If the user does not have permission to access the data
     */
    async getStats(data, options) {
        if (!await this.isAdmin()) {
            throw new Error("You don't have permission to access this data");
        }

        if (data.userId) {
            return await this.models['statistic'].getAllByKey('userId', data.userId);
        } else {
            return await this.models['statistic'].getAll();
        }
    }

    /**
     * Add statistics
     * @param {Object} data - The data object containing the userId
     * @param {Number} data.action - The type of action (e.g. 'mouseMove')
     * @param {Object} options - not used
     *
     * @returns {Promise<void>} - The statistics data
     */
    async addStats(data, options) {
        try {
            if (this.user.acceptStats) {
                await this.models["statistic"].add({
                    action: data.action,
                    data: JSON.stringify(data.data),
                    userId: this.userId,
                    session: this.socket.id,
                    timestamp: new Date(),
                })
            }
        } catch (e) {
            this.logger.error("Can't add statistics: " + JSON.stringify(data) + " due to error " + e.toString());
        }
    }

    /**
     * Get a user's statistics
     *
     * @param {Object} data - The data object containing the userId
     * @param {Number} data.userId - The user's ID
     * @param {Object} options - not used
     *
     * @returns {Promise<void>} - The statistics data
     */
    async getStatsByUser(data, options) {
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
    }

    init() {
        this.createSocket("statsGet", this.getStats, {}, false);
        this.createSocket("stats", this.addStats, {}, true);
        this.createSocket("statsGetByUser", this.getStatsByUser, {}, true);
    }
}