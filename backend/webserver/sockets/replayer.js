'use strict';

const Socket = require('../Socket.js');
const { replayUserTraces } = require('../replay/worker');
const throttle = require('lodash/throttle');

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
            progressId = null,
            latencyThreshold = Infinity,
            singleLevel = null,
        } = data;

        if (!Array.isArray(recordingIds) || recordingIds.length === 0) {
            throw new Error('recordingIds must be a non-empty array');
        }
        if (!singleLevel && (!Number.isInteger(maxIterations) || maxIterations < 1)) {
            throw new Error('maxIterations must be a positive integer');
        }

        // Pool sessions from every selected recording
        const pool = await this.buildSessionPool(recordingIds);

        if (pool.sessions.length === 0) {
            throw new Error('No replayable sessions found in selected recordings');
        }

        const serverUrl = `http://localhost:${process.env.CONTENT_SERVER_PORT || 3001}`;

        if (Number.isInteger(singleLevel) && singleLevel > 0) {
            return await this.runOneLevel(pool, serverUrl, timingMode, singleLevel, ackTimeout, progressId);
        }

        const iterations = await this.runScalingTest(
            pool, serverUrl, timingMode, continueOnFailure, maxIterations, ackTimeout, progressId, latencyThreshold
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

        // Fetch all recordings up front (one query) and index by id, rather
        // than a findByPk per id inside the loop.
        const recordings = await this.models['recording'].findAll({
            where: { id: recordingIds },
        });
        const recordingById = new Map(recordings.map(r => [r.id, r]));

        for (const recordingId of recordingIds) {
            const recording = recordingById.get(recordingId);
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
     * Run one level of `concurrency` parallel sessions once, return its results.
     * Used by the client-driven ceiling finder (open-ended escalation).
     */
    async runOneLevel(pool, serverUrl, timingMode, concurrency, ackTimeout, progressId = null) {
        const N = pool.sessions.length;
        const activeSessions = [];
        for (let i = 0; i < concurrency; i++) activeSessions.push(pool.sessions[i % N]);

        // Per-trace progress for this one level. Total = concurrency * traces-per-session.
        const totalTraces = concurrency * (N > 0 ? Math.round(pool.sessions.reduce((s, x) => s + x.traces.length, 0) / N) : 0);
        let completed = 0, lastPct = -1;
        const emitProgress = throttle(() => {
            this.socket.emit("progressUpdate", { id: progressId, current: completed, total: totalTraces });
        }, 500);
        const onTraceProgress = () => {
            completed++;
            if (!progressId || totalTraces === 0) return;
            const pct = Math.floor((completed / totalTraces) * 100);
            if (pct !== lastPct) { lastPct = pct; emitProgress(); }
        };

        const start = Date.now();
        const results = await Promise.all(
            activeSessions.map(session => {
                const user = pool.userMap.get(session.userId);
                return replayUserTraces(this.server, user, session.traces, serverUrl, timingMode, ackTimeout, onTraceProgress)
                    .then(r => ({ ...r, sessionKey: session.sessionKey, recordingId: session.recordingId, recordingName: session.recordingName }));
            })
        );
        emitProgress.flush();
        return { sessions: concurrency, results, duration: Date.now() - start };
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
    async runScalingTest(pool, serverUrl, timingMode, continueOnFailure, maxIterations, ackTimeout, progressId = null, latencyThreshold = Infinity) {
        const allResults = [];
        const N = pool.sessions.length;

        // Total traces replayed across the whole run, for fine-grained progress.
        // One pool pass replays the sum of every session's traces; iteration K
        // runs K passes, so the grand total is that sum times (1+2+...+max).
        const tracesPerPass = pool.sessions.reduce((sum, s) => sum + s.traces.length, 0);
        const totalTraces = tracesPerPass * (maxIterations * (maxIterations + 1) / 2);

        // Emit progress per trace, but throttle to once per whole-percent change
        // so a large run doesn't flood the admin socket with thousands of events.
        let completedTraces = 0;
        let lastPct = -1;

        // Rate-limit the emit to at most once per 500ms (trailing: always sends
        // the latest value). Layered on top of the percent-change filter below,
        // so on fast runs where the percent changes many times a second we still
        // cap the socket traffic. Per Dennis's suggestion (lodash throttle).
        const emitProgress = throttle(() => {
            this.socket.emit("progressUpdate", {
                id: progressId,
                current: completedTraces,
                total: totalTraces,
            });
        }, 500);

        const onTraceProgress = () => {
            completedTraces++;
            if (!progressId || totalTraces === 0) return;
            const pct = Math.floor((completedTraces / totalTraces) * 100);
            if (pct !== lastPct) {
                lastPct = pct;
                emitProgress();
            }
        };

        for (let level = 1; level <= maxIterations; level++) {
            // Iteration K runs K full copies of the pool. Total sockets = K * N.
            // Sessions are picked with wraparound, so iteration K's list is
            // pool[0], pool[1], ..., pool[N-1], pool[0], pool[1], ... (K times).
            const totalSockets = level * N;
            const activeSessions = [];
            for (let i = 0; i < totalSockets; i++) {
                activeSessions.push(pool.sessions[i % N]);
            }

            const levelStart = Date.now();
            const levelResults = await Promise.all(
                activeSessions.map(session => {
                    const user = pool.userMap.get(session.userId);
                    return replayUserTraces(this.server, user, session.traces, serverUrl, timingMode, ackTimeout, onTraceProgress)
                        .then(result => ({
                            ...result,
                            sessionKey: session.sessionKey,
                            recordingId: session.recordingId,
                            recordingName: session.recordingName,
                        }));
                })
            );
            const levelDuration = Date.now() - levelStart;

            const levelFailed = levelResults.some(r => r.failed > 0);

            // p95 latency across all this level's traces — the "too much delay"
            // stop signal. Catches degradation (pool pressure) before hard
            // failures. Off by default (Infinity); the perf tool opts in.
            const levelLatencies = [];
            for (const r of levelResults) {
                for (const l of (r.latencies || [])) levelLatencies.push(l.latency);
            }
            levelLatencies.sort((a, b) => a - b);
            const p95 = levelLatencies.length
                ? levelLatencies[Math.min(levelLatencies.length - 1, Math.floor(0.95 * levelLatencies.length))]
                : 0;
            const latencyExceeded = p95 > latencyThreshold;

            allResults.push({
                level,
                sessions: totalSockets,
                results: levelResults,
                passed: !levelFailed,
                duration: levelDuration,
                p95,
            });

            if ((levelFailed || latencyExceeded) && !continueOnFailure) {
                const reason = levelFailed
                    ? 'trace failure'
                    : `p95 latency ${p95}ms exceeded threshold ${latencyThreshold}ms`;
                this.sendToast(`Replay stopped at iteration ${level} (${reason})`, 'Replay', 'danger');
                break;
            }
        }

        // Force out the final throttled update so the bar lands on its true
        // end value instead of being left one throttle-window short. Runs on
        // both normal completion and early-failure break above.
        emitProgress.flush();

        return allResults;
    }

    init() {
        this.createSocket('replayRun', this.replayRun, {}, false);
    }
}

module.exports = ReplayerSocket;