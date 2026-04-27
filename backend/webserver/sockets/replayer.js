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

        const sessionMap = this.groupTracesBySocket(traces);
        const sessionKeys = Array.from(sessionMap.keys());

        if (sessionKeys.length === 0) {
            throw new Error('No user-tagged traces found');
        }

        const userIds = [...new Set([...sessionMap.values()].map(s => s.userId))];
        const users = await this.models['user'].findAll({
            where: { id: userIds },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        const serverUrl = `http://localhost:${process.env.CONTENT_SERVER_PORT || 3001}`;

        return await this.runScalingTest(sessionKeys, sessionMap, userMap, serverUrl, timingMode);
    }

    /**
     * Group trace rows by socketId, falling back to "user-{userId}" when
     * socketId is null (older recordings captured before per-session
     * tracking was added).
     * @param {Array<Object>} traces - Trace rows sorted by startTime
     * @returns {Map<string, {userId: number, traces: Array<Object>}>} Map of session key to its traces and owning user
     */
    groupTracesBySocket(traces) {
        const map = new Map();
        for (const t of traces) {
            if (!t.userId) continue;
            // Use socketId as the session key; fall back to a synthetic key
            // for legacy recordings so they still replay (collapsed by user).
            const key = t.socketId || `user-${t.userId}`;
            if (!map.has(key)) {
                map.set(key, { userId: t.userId, traces: [] });
            }
            map.get(key).traces.push(t);
        }
        return map;
    }

    /**
     * Execute the scaling-correctness loop, adding one session per iteration.
     * @param {Array<string>} sessionKeys - Ordered list of session keys (socketIds or fallback) to scale through
     * @param {Map<string, {userId: number, traces: Array<Object>}>} sessionMap - Map of session key to its user and traces
     * @param {Map<number, Object>} userMap - Map of userId to user row
     * @param {string} serverUrl - Target server URL
     * @param {string} timingMode - "realtime" or "fast"
     * @returns {Promise<Array<Object>>} Results per iteration
     */
    async runScalingTest(sessionKeys, sessionMap, userMap, serverUrl, timingMode) {
        const allResults = [];

        for (let level = 1; level <= sessionKeys.length; level++) {
            const activeKeys = sessionKeys.slice(0, level);

            this.sendToast(
                `Iteration ${level}/${sessionKeys.length}: replaying ${activeKeys.length} session(s)`,
                'Replay',
                'info'
            );

            const levelResults = await Promise.all(
                activeKeys.map(key => {
                    const session = sessionMap.get(key);
                    const user = userMap.get(session.userId);
                    return replayUserTraces(this.server, user, session.traces, serverUrl, timingMode);
                })
            );

            const levelFailed = levelResults.some(r => r.failed > 0);
            allResults.push({
                level,
                users: activeKeys.length,
                results: levelResults,
                passed: !levelFailed,
            });

            if (levelFailed) {
                this.sendToast(`Replay failed at iteration ${level}`, 'Replay', 'danger');
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