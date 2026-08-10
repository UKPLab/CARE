'use strict';

/**
 * Group a recording's traces into one session per originating socket. Traces
 * with no userId are skipped — they can't be replayed as anyone. Traces
 * missing a socketId fall back to a per-user key so they still form a session.
 * @param {Array<Object>} traces - Trace rows sorted by startTime
 * @returns {Map<string, {userId: number, traces: Array<Object>}>} Map of session key to that session's user and traces
 */
function groupTracesBySocket(traces) {
    const map = new Map();
    for (const t of traces) {
        if (!t.userId) {
            continue;
        }
        const key = t.socketId || `user-${t.userId}`;
        if (!map.has(key)) {
            map.set(key, {userId: t.userId, traces: []});
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
function buildActiveSessions(pool, count) {
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

module.exports = {groupTracesBySocket, buildActiveSessions};
