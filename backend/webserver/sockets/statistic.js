const TranslatableError = require("../../utils/TranslatableError");
const Socket = require("../Socket.js");

/**
 * Actions that can be sent several times per second. They are buffered and written in batches.
 * All other actions are written right away, so a crash, shutdown or reconnect cannot lose them.
 */
const BUFFERED_ACTIONS = new Set([
    "mouseMove",
    "annotatorScrollActivity",
    "pdfPageVisibilityChange",
    "pdfPageResizeChange",
    "sidebarResize",
]);

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
                    message: "errors.statistics.userRightsArgumentMismatch"
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
            throw new TranslatableError("errors.permission.noPermissionToAccesData");
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
     * Actions in BUFFERED_ACTIONS are buffered and written in batches. All other actions are written right away,
     * and the browser's callback (if given) is answered once the write is done.
     * 
     * @socketEvent stats
     * @param {Object} data The data object containing the userId
     * @param {Number} data.action The type of action (e.g. 'mouseMove')
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the statistic has been processed.
     */
    async addStats(data, options) {
        if (!this.user.acceptStats) return;
        const entry = {
            action: data.action,
            data: JSON.stringify(data.data || {}),
            userId: this.userId,
            session: this.socket.id,
            timestamp: new Date(),
        };

        if (!BUFFERED_ACTIONS.has(data.action)) {
            // Rare actions are written right away, so a crash, shutdown or reconnect cannot lose them.
            // A failed write reaches the browser's callback as {success: false}.
            await this.models["statistic"].create(entry);
            return;
        }

        try {
            this.statsBuffer.push(entry);
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
        // Take the current batch first, so events added while the insert runs stay in the new buffer
        const batch = this.statsBuffer;
        this.statsBuffer = [];
        try {
            await this.models["statistic"].bulkCreate(batch);
        } catch (e) {
            this.logger.error("Failed to flush statistics batch: " + e.toString());
        } finally {
            this.statsFlushing = false;
        }
    }

    async init() {
        // Register the handlers before the first await: after a reconnect the browser sends its
        // buffered events right away, and events that arrive before a handler exists are dropped
        this.createSocket("statsGet", this.getStats, {}, false);
        this.createSocket("stats", this.addStats, {}, false);
        this.createSocket("statsGetByUser", this.sendStatsByUser, {}, false);
        this.statsBatchSize = parseInt(await this.models['setting'].get("statistics.batch.size"), 10)
    }
}

module.exports = StatisticSocket;