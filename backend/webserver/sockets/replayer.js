'use strict';

const Socket = require('../Socket.js');
const { replayUserTraces } = require('../replay/worker');

/**
 * Handles replaying recorded socket events for stress testing.
 *
 * Scaling mode (pooled): all selected recordings' sessions are combined
 * into one pool of N sessions. Iteration K runs K * N parallel sockets,
 * cycling through the pool with wraparound (linear add per iteration).
 *
 * Example: recording A=[a1, a2], recording B=[b3], maxIterations=3
 *   Iteration 1: [a1, a2, b3]                              (3 sockets)
 *   Iteration 2: [a1, a2, b3, a1, a2, b3]                  (6 sockets)
 *   Iteration 3: [a1, a2, b3, a1, a2, b3, a1, a2, b3]      (9 sockets)
 *
 * @type {ReplayerSocket}
 * @class ReplayerSocket
 */
class ReplayerSocket extends Socket {

    /**
     * Pool sessions from all selected recordings and run a single scaling test
     * across the combined pool.
     * @param {Object} data - Input data from the frontend
     * @param {Array<number>} data.recordingIds - IDs of recordings whose sessions get pooled
     * @param {string} data.timingMode - "realtime" or "fast"
     * @param {boolean} data.continueOnFailure - If true, scaling continues past failed iterations
     * @param {number} data.maxIterations - How many scaling iterations to run (required, > 0)
     * @param {Object} options - Additional configuration parameter
     * @returns {Promise<Array<Object>>} Iteration results
     * @throws {Error} If recordingIds is missing/empty, maxIterations invalid, or pool is empty
     */
    async replayRun(data, options) {
        const {
            recordingIds,
            timingMode = 'fast',
            continueOnFailure = false,
            maxIterations,
            ackTimeout = 2000,
        } = data;

        if (!Array.isArray(recordingIds) || recordingIds.length === 0) {
            throw new Error('recordingIds must be a non-empty array');
        }
        if (!Number.isInteger(maxIterations) || maxIterations < 1) {
            throw new Error('maxIterations must be a positive integer');
        }

        // Pool sessions from every selected recording
        const pool = await this.buildSessionPool(recordingIds);

        if (pool.sessions.length === 0) {
            throw new Error('No replayable sessions found in selected recordings');
        }

        const serverUrl = `http://localhost:${process.env.CONTENT_SERVER_PORT || 3001}`;

        const iterations = await this.runScalingTest(
            pool, serverUrl, timingMode, continueOnFailure, maxIterations, ackTimeout
        );

        return iterations;
    }

    /**
     * Load all selected recordings' traces and combine them into one pool of
     * sessions. Each session keeps a reference to its source recording so we
     * can label results with the recording name.
     *
     * @param {Array<number>} recordingIds - Recordings to pool
     * @returns {Promise<{sessions: Array, userMap: Map}>} Pooled sessions and the user lookup needed for replay
     */
    async buildSessionPool(recordingIds) {
        const sessions = [];
        const userIdSet = new Set();

        for (const recordingId of recordingIds) {
            const recording = await this.models['recording'].findByPk(recordingId);
            if (!recording) continue;

            const traces = await this.models['trace'].findAll({
                where: { recordingId, direction: true, deleted: false },
                order: [['startTime', 'ASC']],
            });
            if (traces.length === 0) continue;

            const sessionMap = this.groupTracesBySocket(traces);
            for (const [key, session] of sessionMap) {
                sessions.push({
                    sessionKey: key,
                    userId: session.userId,
                    traces: session.traces,
                    recordingId,
                    recordingName: recording.name,
                });
                userIdSet.add(session.userId);
            }
        }

        const users = await this.models['user'].findAll({
            where: { id: Array.from(userIdSet) },
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        return { sessions, userMap };
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
            const key = t.socketId || `user-${t.userId}`;
            if (!map.has(key)) {
                map.set(key, { userId: t.userId, traces: [] });
            }
            map.get(key).traces.push(t);
        }
        return map;
    }

    /**
     * Execute the scaling-correctness loop on the pooled session list.
     * Iteration K runs K * N parallel sockets, cycling through the pool
     * with wraparound (linear add: each iteration adds one full copy of
     * the pool to the previous iteration's count).
     *
     * Stops at first failure unless continueOnFailure is true.
     *
     * @param {{sessions: Array, userMap: Map}} pool - Combined session pool from buildSessionPool
     * @param {string} serverUrl - Target server URL
     * @param {string} timingMode - "realtime" or "fast"
     * @param {boolean} continueOnFailure - If true, scaling continues past failed iterations
     * @param {number} maxIterations - Number of iterations to run
     * @returns {Promise<Array<Object>>} Iteration results
     */
    async runScalingTest(pool, serverUrl, timingMode, continueOnFailure, maxIterations, ackTimeout) {
        const allResults = [];
        const N = pool.sessions.length;

        for (let level = 1; level <= maxIterations; level++) {
            // Iteration K runs K full copies of the pool. Total sockets = K * N.
            // Sessions are picked with wraparound, so iteration K's list is
            // pool[0], pool[1], ..., pool[N-1], pool[0], pool[1], ... (K times).
            const totalSockets = level * N;
            const activeSessions = [];
            for (let i = 0; i < totalSockets; i++) {
                activeSessions.push(pool.sessions[i % N]);
            }

            this.sendToast(
                `Iteration ${level}/${maxIterations}: ${totalSockets} parallel session(s)`,
                'Replay',
                'info'
            );

            const levelResults = await Promise.all(
                activeSessions.map(session => {
                    const user = pool.userMap.get(session.userId);
                    return replayUserTraces(this.server, user, session.traces, serverUrl, timingMode, ackTimeout)
                        .then(result => ({
                            ...result,
                            sessionKey: session.sessionKey,
                            recordingId: session.recordingId,
                            recordingName: session.recordingName,
                        }));
                })
            );

            const levelFailed = levelResults.some(r => r.failed > 0);
            allResults.push({
                level,
                sessions: totalSockets,
                results: levelResults,
                passed: !levelFailed,
            });

            if (levelFailed && !continueOnFailure) {
                this.sendToast(`Replay stopped at iteration ${level}`, 'Replay', 'danger');
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