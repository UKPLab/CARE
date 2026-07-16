'use strict';

const Socket = require('../Socket.js');
const { replayUserTraces } = require('../replay/worker');
const throttle = require('lodash/throttle');

// Ceilings on caller-supplied load parameters. Replay opens real sockets
// against this server, so an unbounded value is a self-inflicted outage rather
// than a test.
const MAX_ITERATIONS = 100;
const MAX_CONCURRENCY = 500;

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
     * Pool sessions and run a scaling test across the combined pool. Input is
     * either recordingIds (loaded from the DB) or sessions (supplied from
     * exported recording files, so the CLI can replay without importing) —
     * exactly one of the two.
     *
     * @param {Object} data - Input data from the caller (frontend or perf CLI)
     * @param {Array<number>} [data.recordingIds] - Recordings to pool from the DB
     * @param {Array<Object>} [data.sessions] - Sessions from exported files; each is {sessionKey?, recordingName?, traces}
     * @param {string} [data.timingMode="fast"] - "realtime" preserves original delays, "fast" skips them
     * @param {boolean} [data.continueOnFailure=false] - If true, scaling continues past failed iterations
     * @param {number} [data.maxIterations] - Scaling iterations to run; required unless singleLevel is set
     * @param {number} [data.ackTimeout=2000] - Max ms to wait for the server to ack each trace
     * @param {string} [data.progressId=null] - Id to emit progressUpdate against; null disables progress
     * @param {number} [data.latencyThreshold=Infinity] - Stop if a level's p95 latency exceeds this (ms)
     * @param {number} [data.singleLevel=null] - Run one level at this concurrency instead of scaling
     * @param {Object} options - Additional configuration parameter
     * @returns {Promise<Array<Object>|Object>} Iteration results, or one level's result when singleLevel is set
     * @throws {Error} If the caller is not an admin, if neither or both of recordingIds/sessions are given, if maxIterations is invalid, or if the pool is empty
     */
    async replayRun(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("Admin access required");
        }
        const {
            recordingIds,
            sessions,
            timingMode = 'fast',
            continueOnFailure = false,
            maxIterations,
            ackTimeout = 2000,
            progressId = null,
            latencyThreshold = Infinity,
            singleLevel = null,
        } = data;

        const hasIds = Array.isArray(recordingIds) && recordingIds.length > 0;
        const hasSessions = Array.isArray(sessions) && sessions.length > 0;
        if (hasIds && hasSessions) {
            throw new Error('Provide either recordingIds or sessions, not both');
        }
        if (!hasIds && !hasSessions) {
            throw new Error('Provide recordingIds (DB replay) or sessions (file replay)');
        }
        if (singleLevel !== null && !Number.isInteger(singleLevel)) {
            throw new Error('singleLevel must be an integer');
        }
        if (Number.isInteger(singleLevel) && (singleLevel < 1 || singleLevel > MAX_CONCURRENCY)) {
            throw new Error(`singleLevel must be between 1 and ${MAX_CONCURRENCY}`);
        }
        if (singleLevel === null && (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > MAX_ITERATIONS)) {
            throw new Error(`maxIterations must be an integer between 1 and ${MAX_ITERATIONS}`);
        }

        // Pool from the DB (recordingIds) or straight from a file payload
        // (sessions). Both return the same {sessions, userMap} shape.
        const pool = hasSessions
            ? await this.buildSessionPoolFromPayload(sessions)
            : await this.buildSessionPool(recordingIds);

        if (pool.sessions.length === 0) {
            throw new Error('No replayable sessions found in selected recordings');
        }

        // Replay-target URL. Defaults to the local content server, but can be
        // overridden via REPLAY_TARGET_URL for deployments where the content
        // server isn't on localhost or uses a non-standard host/port.
        const serverUrl = process.env.REPLAY_TARGET_URL
            || `http://localhost:${process.env.CONTENT_SERVER_PORT || 3001}`;

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
        const recordings = await this.models['recording'].getAllByKeyValues('id', recordingIds);
        const recordingById = new Map(recordings.map(r => [r.id, r]));

        for (const recordingId of recordingIds) {
            const recording = recordingById.get(recordingId);
            if (!recording) {
                this.logger.warn(`Replay: recording ${recordingId} not found or deleted — skipped`);
                continue;
            }

            // Only client->server traces are replayable; server pushes are
            // captured for diagnostics but must not be emitted back.
            const allTraces = await this.models['trace'].getAllByKey('recordingId', recordingId);
            const traces = allTraces
                .filter(t => t.direction === true)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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

        const users = await this.models['user'].getAllByKeyValues('id', Array.from(userIdSet));
        const userMap = new Map(users.map(u => [u.id, u]));

        // A recorded user may have been deleted since capture. Those sessions
        // can't be authenticated, so drop them rather than let a missing user
        // crash the whole run in the replay worker.
        const replayable = sessions.filter(s => {
            if (userMap.has(s.userId)) {
                return true;
            }
            this.logger.warn(`Replay: user ${s.userId} no longer exists — session ${s.sessionKey} skipped`);
            return false;
        });

        return { sessions: replayable, userMap };
    }

    /**
     * Build the same {sessions, userMap} pool from exported recording files
     * instead of the DB, so the CLI can replay without importing.
     *
     * The file's own userId values belong to the source database and won't map
     * to a real user here, so — exactly as the DB import path already does —
     * every file session replays as the caller running the tool (this.userId).
     * One real user row is fetched for auth; the recording data never touches
     * the DB.
     *
     * @param {Array<Object>} payloadSessions - Sessions from files; each is {sessionKey?, recordingName?, traces: Array<Object>}
     * @returns {Promise<{sessions: Array, userMap: Map}>} Pooled sessions and the acting-user lookup
     * @throws {Error} If the acting user cannot be resolved
     */
    async buildSessionPoolFromPayload(payloadSessions) {
        const actingUser = await this.models['user'].getById(this.userId);
        if (!actingUser) {
            throw new Error('Could not resolve the acting user for file replay');
        }

        const sessions = [];
        for (const incoming of payloadSessions) {
            const rawTraces = Array.isArray(incoming.traces) ? incoming.traces : [];
            // File contents are unvalidated input: a trace without a usable
            // action name would be emitted as-is by the replay worker.
            const traces = rawTraces
                .filter(t => t && t.direction === true && typeof t.action === 'string' && t.action.length > 0)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            if (traces.length === 0) continue;

            // Group first, then stamp: grouping falls back to the trace's own
            // userId when socketId is absent (older recordings), so overwriting
            // userId beforehand would merge distinct users into one session.
            const sessionMap = this.groupTracesBySocket(traces);
            const multiSession = sessionMap.size > 1;
            for (const [key, session] of sessionMap) {
                sessions.push({
                    // The file's own key only identifies the file, so it can't
                    // label more than one session from it.
                    sessionKey: (!multiSession && incoming.sessionKey) ? incoming.sessionKey : key,
                    userId: actingUser.id,
                    traces: session.traces.map(t => ({ ...t, userId: actingUser.id })),
                    recordingId: null,
                    recordingName: incoming.recordingName || 'file',
                });
            }
        }

        const userMap = new Map([[actingUser.id, actingUser]]);
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
     * Pick `count` sessions from the pool with wraparound, so a level of any
     * size can be built from a pool of N sessions.
     * @param {{sessions: Array}} pool - Session pool
     * @param {number} count - How many sessions this level runs
     * @returns {Array<Object>} The level's session list
     */
    buildActiveSessions(pool, count) {
        const N = pool.sessions.length;
        if (N === 0) {
            return [];
        }
        const activeSessions = [];
        for (let i = 0; i < count; i++) {
            activeSessions.push(pool.sessions[i % N]);
        }
        return activeSessions;
    }

    /**
     * Build a throttled per-trace progress reporter. Emits at most once per
     * 500ms and only on whole-percent changes, so a large run doesn't flood the
     * socket with thousands of events. (Throttle per Dennis's suggestion.)
     * @param {string|null} progressId - Id to emit against; null disables reporting
     * @param {number} totalTraces - Denominator for the percentage
     * @returns {{onTraceProgress: Function, flush: Function}} Reporter handles
     */
    makeProgressReporter(progressId, totalTraces) {
        let completed = 0;
        let lastPct = -1;
        const emitProgress = throttle(() => {
            this.socket.emit('progressUpdate', {
                id: progressId,
                current: completed,
                total: totalTraces,
            });
        }, 500);
        const onTraceProgress = () => {
            completed++;
            if (!progressId || totalTraces === 0) {
                return;
            }
            const pct = Math.floor((completed / totalTraces) * 100);
            if (pct !== lastPct) {
                lastPct = pct;
                emitProgress();
            }
        };
        return { onTraceProgress, flush: () => emitProgress.flush() };
    }

    /**
     * Replay one list of sessions in parallel, labelling each result with its
     * source session.
     * @param {Array<Object>} activeSessions - Sessions to run concurrently
     * @param {Map} userMap - Maps a session's userId to its user row
     * @param {string} serverUrl - Replay target URL
     * @param {string} timingMode - "realtime" or "fast"
     * @param {number} ackTimeout - Max ms to wait for each trace's ack
     * @param {Function} onTraceProgress - Called once per completed trace
     * @returns {Promise<Array<Object>>} One result per session
     */
    async runSessions(activeSessions, userMap, serverUrl, timingMode, ackTimeout, onTraceProgress) {
        return await Promise.all(
            activeSessions.map(session => {
                const user = userMap.get(session.userId);
                return replayUserTraces(this.server, user, session.traces, serverUrl, timingMode, ackTimeout, onTraceProgress)
                    .then(result => ({
                        ...result,
                        sessionKey: session.sessionKey,
                        recordingId: session.recordingId,
                        recordingName: session.recordingName,
                    }));
            })
        );
    }

    /**
     * Run one level of `concurrency` parallel sessions once and return its
     * results. Used by the client-driven ceiling finder (open-ended escalation).
     * @param {{sessions: Array, userMap: Map}} pool - Session pool
     * @param {string} serverUrl - Replay target URL
     * @param {string} timingMode - "realtime" or "fast"
     * @param {number} concurrency - How many parallel sessions to run
     * @param {number} ackTimeout - Max ms to wait for each trace's ack
     * @param {string} [progressId=null] - Id to emit progressUpdate against
     * @returns {Promise<{sessions: number, results: Array<Object>, duration: number}>} The level's result
     */
    async runOneLevel(pool, serverUrl, timingMode, concurrency, ackTimeout, progressId = null) {
        const activeSessions = this.buildActiveSessions(pool, concurrency);
        // Sum the sessions actually picked: with wraparound over unequal session
        // sizes, concurrency * average would not match what gets replayed.
        const totalTraces = activeSessions.reduce((sum, s) => sum + s.traces.length, 0);
        const progress = this.makeProgressReporter(progressId, totalTraces);

        const start = Date.now();
        const results = await this.runSessions(
            activeSessions, pool.userMap, serverUrl, timingMode, ackTimeout, progress.onTraceProgress
        );
        progress.flush();
        return { sessions: concurrency, results, duration: Date.now() - start };
    }

    /**
     * Execute the scaling loop on the pooled session list. Iteration K runs
     * K * N parallel sockets, cycling through the pool with wraparound (linear
     * add: each iteration adds one full copy of the pool to the previous count).
     * Stops at the first failing level unless continueOnFailure is true.
     *
     * @param {{sessions: Array, userMap: Map}} pool - Combined session pool
     * @param {string} serverUrl - Replay target URL
     * @param {string} timingMode - "realtime" or "fast"
     * @param {boolean} continueOnFailure - If true, scaling continues past failed iterations
     * @param {number} maxIterations - Number of iterations to run
     * @param {number} ackTimeout - Max ms to wait for each trace's ack
     * @param {string} [progressId=null] - Id to emit progressUpdate against
     * @param {number} [latencyThreshold=Infinity] - Stop if a level's p95 exceeds this (ms)
     * @returns {Promise<Array<Object>>} One entry per iteration run
     */
    async runScalingTest(pool, serverUrl, timingMode, continueOnFailure, maxIterations, ackTimeout, progressId = null, latencyThreshold = Infinity) {
        const allResults = [];
        const N = pool.sessions.length;

        // Total traces replayed across the whole run, for fine-grained progress.
        // One pool pass replays the sum of every session's traces; iteration K
        // runs K passes, so the grand total is that sum times (1+2+...+max).
        const tracesPerPass = pool.sessions.reduce((sum, s) => sum + s.traces.length, 0);
        const totalTraces = tracesPerPass * (maxIterations * (maxIterations + 1) / 2);

        const progress = this.makeProgressReporter(progressId, totalTraces);

        for (let level = 1; level <= maxIterations; level++) {
            // Iteration K runs K full copies of the pool. Total sockets = K * N.
            // Sessions are picked with wraparound, so iteration K's list is
            // pool[0], pool[1], ..., pool[N-1], pool[0], pool[1], ... (K times).
            const totalSockets = level * N;
            const activeSessions = this.buildActiveSessions(pool, totalSockets);

            const levelStart = Date.now();
            const levelResults = await this.runSessions(
                activeSessions, pool.userMap, serverUrl, timingMode, ackTimeout, progress.onTraceProgress
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
        progress.flush();

        return allResults;
    }

    init() {
        this.createSocket('replayRun', this.replayRun, {}, false);
    }
}

module.exports = ReplayerSocket;