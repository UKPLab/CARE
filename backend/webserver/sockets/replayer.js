'use strict';

const Socket = require('../Socket.js');
const { replayUserTraces } = require('../replay/worker');

/**
 * Handles replaying recorded socket events for stress testing.
 * Uses a scaling-correctness approach: replays one user's traces,
 * verifies all pass, adds another user in parallel, and scales
 * until something breaks.
 *
 * @type {ReplayerSocket}
 * @class ReplayerSocket
 */
class ReplayerSocket extends Socket {

    /**
     * Run a scaling-correctness replay for a recording.
     * @param {Object} data - The input data from the frontend
     * @param {number} data.recordingId - ID of the recording to replay
     * @param {string} data.timingMode - "realtime" or "fast"
     * @param {Object} options - Additional configuration parameter
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<Array<Object>>} Results per scaling level
     * @throws {Error} If recordingId is missing or recording has no traces
     */
    async replayRun(data, options) {
        const { recordingId, timingMode = 'fast' } = data;

        if (!recordingId) {
            throw new Error('recordingId is required');
        }

        const recording = await this.models['recording'].findByPk(recordingId);
        if (!recording) {
            throw new Error('Recording not found');
        }

        const traces = await this.models['trace'].findAll({
            where: { recordingId, direction: true, deleted: false },
            order: [['startTime', 'ASC']],
        });

        if (traces.length === 0) {
            throw new Error('No traces found for this recording');
        }

        const userTraceMap = this.groupTracesByUser(traces);
        const userIds = Array.from(userTraceMap.keys());

        if (userIds.length === 0) {
            throw new Error('No user-tagged traces found');
        }

        const users = await this.models['user'].findAll({
            where: { id: userIds },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        const serverUrl = `http://localhost:${process.env.CONTENT_SERVER_PORT || 3001}`;

        return await this.runScalingTest(userIds, userMap, userTraceMap, serverUrl, timingMode);
    }

    /**
     * Group trace rows by userId.
     * @param {Array<Object>} traces - Trace rows sorted by startTime
     * @returns {Map<number, Array<Object>>} Map of userId to their traces
     */
    groupTracesByUser(traces) {
        const map = new Map();
        for (const t of traces) {
            if (!t.userId) continue;
            if (!map.has(t.userId)) {
                map.set(t.userId, []);
            }
            map.get(t.userId).push(t);
        }
        return map;
    }

    /**
     * Execute the scaling-correctness loop, adding one user per level.
     * @param {Array<number>} userIds - Ordered list of user IDs to scale through
     * @param {Map<number, Object>} userMap - Map of userId to user row
     * @param {Map<number, Array<Object>>} userTraceMap - Map of userId to traces
     * @param {string} serverUrl - Target server URL
     * @param {string} timingMode - "realtime" or "fast"
     * @returns {Promise<Array<Object>>} Results per level
     */
    async runScalingTest(userIds, userMap, userTraceMap, serverUrl, timingMode) {
        const allResults = [];

        for (let level = 1; level <= userIds.length; level++) {
            const activeUserIds = userIds.slice(0, level);

            this.sendToast(
                `Level ${level}/${userIds.length}: replaying ${activeUserIds.length} user(s)`,
                'Replay',
                'info'
            );

            const levelResults = await Promise.all(
                activeUserIds.map(uid => {
                    const user = userMap.get(uid);
                    const userTraces = userTraceMap.get(uid);
                    return replayUserTraces(this.server, user, userTraces, serverUrl, timingMode);
                })
            );

            const levelFailed = levelResults.some(r => r.failed > 0);
            allResults.push({
                level,
                users: activeUserIds.length,
                results: levelResults,
                passed: !levelFailed,
            });

            if (levelFailed) {
                this.sendToast(`Replay failed at level ${level}`, 'Replay', 'danger');
                break;
            }
        }

        return allResults;
    }

    init() {
        this.createSocket('replayRun', this.replayRun, {}, false);
    }
}

module.exports = ReplayerSocket;