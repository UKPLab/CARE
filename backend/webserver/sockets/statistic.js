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
 * @class StatisticSocket
 */
class StatisticSocket extends Socket {
    constructor(server, io, socket) {
        super(server, io, socket);
        // Simple in-memory batching; batch size configurable via setting 'statistic.batch.size' or env fallback
        this.statsBuffer = [];
        this.statsFlushing = false;
        // Start with a safe default; load real value asynchronously
        this.statsBatchSize = null;
    }

    /**
     * Send statistics to the user
     * This function is restricted to administrators and will only send data if the target user
     * has consented to statistics collection (`acceptStats` is true).
     * 
     * @param {number} data.userId The ID of the user whose statistics are to be fetched.
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) after the operation is complete. 
     */
    async sendStatsByUser(data, options) {       
        if (await this.isAdmin()) {
            if ((await this.models["user"].getById(data.userId)).acceptStats) {
                const stats = await this.models['statistic'].getAllByKey('userId', data.userId);
                this.socket.emit("statsDataByUser", {success: true, userId: data.userId, statistics: stats});
            } else {
                this.socket.emit("statsDataByUser", {
                    success: false,
                    userId: data.userId,
                    message: "User rights and argument mismatch"
                });
                this.logger.error("User right and request parameter mismatch. User did not agree to stats collection.");
            }

        }
    }

    /**
     * Fetches system statistics, either for all users or a specific user.
     * This function is restricted to users with administrator privileges.
     * 
     * @socketEvent statsGet
     * @param {Object} data The data object containing the userId
     * @param {Number} data.userId The userId to get statistics for (optional)
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<Object>} A promise that resolves with an array of statistic record objects from the database.
     * @throws {Error} Throws an error if the requesting user is not an administrator.
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
     * Adds a new statistic entry to the database for the current user.
     * This function is only performed if the user has consented to statistics collection (`acceptStats` is true).
     * Errors during the database operation are caught and logged internally.
     * 
     * @socketEvent stats
     * @param {Object} data The data object containing the userId
     * @param {Number} data.action The type of action (e.g. 'mouseMove')
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the statistic has been processed.
     */
    async addStats(data, options) {
        try {
            if (!this.user.acceptStats) return;
            this.statsBuffer.push({
                action: data.action,
                data: JSON.stringify(data.data || {}),
                userId: this.userId,
                session: this.socket.id,
                timestamp: new Date(),
            });
            if (this.statsBuffer.length >= this.statsBatchSize && !this.statsFlushing) {
                await this._flushStats();
            }
        } catch (e) {
            this.logger.error("Can't add statistics: " + JSON.stringify(data) + " due to error " + e.toString());
        }
    }

    /**
     * Flush the in-memory statistics buffer to the database in a single bulk insert.
     *
     * Concurrency / safety:
     * - Guarded by the statsFlushing flag so only one flush runs at a time.
     * - If buffer is empty or a flush is already running, returns immediately.
     *
     * Behavior:
     * - Uses bulkCreate for efficiency (reduced round trips).
     * - On success: clears the buffer.
     * - On failure: logs error and still clears buffer to avoid perpetual retry / duplication.
     *
     * @private
     * @returns {Promise<void>}
     */
    async _flushStats() {
        if (this.statsFlushing || this.statsBuffer.length === 0) {
            return;
        }
        this.statsFlushing = true;
        try {
            await this.models["statistic"].bulkCreate(this.statsBuffer);
        } catch (e) {
            this.logger.error("Failed to flush statistics batch: " + e.toString());
        } finally {
            this.statsFlushing = false;
            this.statsBuffer = [];
        }
    }

    async init() {
        this.statsBatchSize = parseInt(await this.models['setting'].get("statistics.batch.size"), 10)
        this.createSocket("statsGet", this.getStats, {}, false);
        this.createSocket("stats", this.addStats, {}, false);
        this.createSocket("statsGetByUser", this.sendStatsByUser, {}, false);
    }
}

module.exports = StatisticSocket;