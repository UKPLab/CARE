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

/**
 * Restore Buffers that JSON.stringify and JSONB storage flatten into
 * {type:'Buffer', data:[…]}. Traces carrying file bytes (documentAdd and
 * friends) hold a Buffer when captured, but Postgres has no binary type inside
 * JSONB, so what comes back out is a plain object — which the handler rejects.
 * Walks the whole payload rather than a known key, since any event may nest
 * file bytes anywhere.
 * @param {*} value - Any value from a stored or parsed trace payload
 * @returns {*} The same structure with Buffer-shaped objects converted back to Buffers
 */
function reviveBuffers(value) {
    if (Array.isArray(value)) {
        return value.map(reviveBuffers);
    }
    if (value && typeof value === 'object') {
        if (value.type === 'Buffer' && Array.isArray(value.data)) {
            return Buffer.from(value.data);
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = reviveBuffers(v);
        }
        return out;
    }
    return value;
}

/**
 * Collect the hash each row had at capture time, from a recording's incoming
 * Refresh traces. Keyed "table:id" to match what the replay observes live.
 * @param {Array<Object>} rawTraces - All of a recording's traces, both directions
 * @returns {Map<string, string>} "table:id" to the hash recorded for that row
 */
function extractRecordedHashes(rawTraces) {
    const recorded = new Map();
    for (const t of rawTraces) {
        if (!t || t.direction !== false || typeof t.action !== 'string' || !t.action.endsWith('Refresh')) {
            continue;
        }
        const records = Array.isArray(t.payload) ? t.payload : [t.payload];
        const table = t.action.replace('Refresh', '');
        for (const r of records) {
            if (r && r.id != null && typeof r.hash === 'string') {
                recorded.set(`${table}:${r.id}`, r.hash);
            }
        }
    }
    return recorded;
}

module.exports = {groupTracesBySocket, buildActiveSessions, reviveBuffers, extractRecordedHashes};
