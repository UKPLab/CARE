'use strict';

const { createAuthenticatedClient, cleanupSession } = require('./replay-auth');

// How long to wait after each trace for the Refresh events it triggered. Long
// enough for a local round-trip, short enough not to dominate replay time —
// a slower Refresh than this is not attributed to its trace.
const DB_CHANGE_WINDOW_MS = 50;

/**
 * Emit a socket event and wait for the server acknowledgement.
 * @param {import("socket.io-client").Socket} client - Connected socket client
 * @param {string} action - Event name to emit
 * @param {Object} payload - Event payload
 * @param {number} timeoutMs - Max wait time for ack
 * @returns {Promise<Object>} The server's response, or {success: false, timedOut: true} if it never acked
 */
function emitWithTimeout(client, action, payload, timeoutMs) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve({ success: false, timedOut: true, message: `No ack within ${timeoutMs}ms` });
        }, timeoutMs);

        // Only null/undefined become {}; a payload of 0, false or "" is real
        // data and must be sent as recorded.
        client.emit(action, payload === null || payload === undefined ? {} : payload, (response) => {
            clearTimeout(timer);
            resolve(response);
        });
    });
}

/**
 * Rewrite recorded hashes in a payload to the ones this replay actually
 * produced. A recording carries the hashes from its capture run, but
 * MetaModel.add generates a fresh uuid on every insert, so a trace that looks
 * a row up by hash would miss. Only hashes we have observed on a Refresh
 * broadcast are swapped — anything unknown is left exactly as recorded, so a
 * miss degrades to current behaviour rather than corrupting the payload.
 * @param {*} value - Any value from a trace payload
 * @param {Map<string, string>} hashMap - Recorded hash to replayed hash
 * @returns {*} The same structure with known hashes replaced
 */
function remapHashes(value, hashMap) {
    if (hashMap.size === 0) {
        return value;
    }
    if (typeof value === 'string') {
        return hashMap.has(value) ? hashMap.get(value) : value;
    }
    if (Array.isArray(value)) {
        return value.map(v => remapHashes(v, hashMap));
    }
    if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = remapHashes(v, hashMap);
        }
        return out;
    }
    return value;
}

/**
 * Replay a single user's traces through an authenticated socket connection.
 * @param {Object} server - CARE server instance
 * @param {Object} user - User row from DB
 * @param {Array<Object>} traces - Trace rows (direction: true only), sorted by startTime
 * @param {string} serverUrl - Target server URL
 * @param {string} timingMode - "realtime" to preserve original delays, "fast" to skip them
 * @param {number} [ackTimeout=2000] - Max wait time in ms for the server to ack each trace
 * @param {Function} [onProgress=null] - Called once per completed trace, for progress reporting
 * @param {Map<string, string>|null} [recordedHashes=null] - "table:id" to the hash that row had at capture time; used to rewrite stale hashes in payloads
 * @returns {Promise<Object>} Results with pass/fail counts, errors, latencies, and DB changes
 * @throws {Error} If user is missing or has no id
 */
async function replayUserTraces(server, user, traces, serverUrl, timingMode, ackTimeout = 2000, onProgress = null, recordedHashes = null, observedHashes = new Map()) {
    // The pool builders filter out sessions with no resolvable user, but this
    // is exported and can't assume its caller did that.
    if (!user || !user.id) {
        throw new Error('replayUserTraces requires a user with an id');
    }
    const results = {
        userId: user.id,
        userName: user.userName,
        total: traces.length,
        passed: 0,
        failed: 0,
        // Traces the server never acked. Kept apart from failures: many CARE
        // events are fire-and-forget, so silence isn't necessarily a fault —
        // but a handler that has stopped responding lands here too, so the
        // list is worth reading rather than ignoring.
        noAck: 0,
        noAckTraces: [],
        errors: [],
        latencies: [],
    };

    let client;
    try {
        client = await createAuthenticatedClient(server, user, serverUrl);
    } catch (err) {
        results.failed = traces.length;
        // No ts: the connection never opened, so there's nothing to timestamp.
        results.errors.push({ action: 'connect', message: err.message });
        return results;
    }

    try {
        let pendingDbChanges = [];

        // Rows the server created during this replay, keyed by "table:id". A
        // recording carries the hashes from its capture run, but MetaModel.add
        // generates a fresh uuid on every insert, so those are stale here.
        // Ids replay deterministically (fixed suite order on a fresh database),
        // so the id is what links a recorded row to its replayed counterpart.


        client.onAny((eventName, ...args) => {
            if (eventName.endsWith('Refresh')) {
                const records = Array.isArray(args[0]) ? args[0] : [args[0]];
                for (const r of records) {
                    if (r && r.id != null && typeof r.hash === 'string') {
                        observedHashes.set(`${eventName.replace('Refresh', '')}:${r.id}`, r.hash);
                    }
                }
                pendingDbChanges.push({
                    table: eventName.replace('Refresh', ''),
                    recordCount: records.length,
                    records: records.map(r => ({
                        id: r?.id,
                        fields: r ? Object.keys(r).filter(k => k !== 'id') : [],
                    })),
                });
            }
        });

        // Recorded hash -> the hash that row has in this replay. Both sides key
        // on "table:id": recordedHashes comes from the recording's Refresh
        // traces, observedHashes from the ones this run received. Ids replay
        // deterministically, so the id is what links them.
        const hashMap = new Map();
        const rememberHashes = () => {
            if (!recordedHashes) {
                return;
            }
            for (const [key, oldHash] of recordedHashes) {
                const newHash = observedHashes.get(key);
                if (newHash && newHash !== oldHash) {
                    hashMap.set(oldHash, newHash);
                }
            }
        };

        let prevTime = traces.length > 0 ? new Date(traces[0].startTime).getTime() : 0;

        for (const trace of traces) {
            if (timingMode === 'realtime') {
                const traceTime = new Date(trace.startTime).getTime();
                const delay = traceTime - prevTime;
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                prevTime = traceTime;
            }

            pendingDbChanges = [];

            // Declared outside the try so the catch below can timestamp the
            // failure too.
            const start = Date.now();
            try {
                rememberHashes();
            
                const ack = await emitWithTimeout(client, trace.action, remapHashes(trace.payload, hashMap), ackTimeout);
                const latency = Date.now() - start;

                // Let any Refresh events triggered by this trace arrive before
                // we snapshot them; anything slower than this window is missed.
                await new Promise(resolve => setTimeout(resolve, DB_CHANGE_WINDOW_MS));
                const dbChanges = [...pendingDbChanges];

                if (ack && ack.timedOut) {
                    // No response within the timeout. Not the same as a
                    // rejection: many CARE events are fire-and-forget and never
                    // ack at all, so failing the story would be wrong. Counted
                    // separately so a genuinely hanging handler still shows up.
                    results.noAck++;
                    results.noAckTraces.push({
                        traceId: trace.id,
                        action: trace.action,
                    });
                } else if (ack && ack.success === false) {
                    results.failed++;
                    results.errors.push({
                        traceId: trace.id,
                        action: trace.action,
                        message: ack.message || 'Server returned success: false',
                        dbChanges,
                    });
                } else {
                    results.passed++;
                    results.latencies.push({
                        ts: start,
                        traceId: trace.id,
                        action: trace.action,
                        latency,
                        dbChanges,
                    });
                }
            } catch (err) {
                results.failed++;
                results.errors.push({
                    ts: start,
                    traceId: trace.id,
                    action: trace.action,
                    message: err.message,
                    dbChanges: [],
                });
            }

            if (onProgress) {
                try {
                    onProgress();
                } catch (e) {
                    // progress reporting must never break replay
                }
            }
        }
    } finally {
        await cleanupSession(server, client);
    }

    return results;
}

module.exports = {
    replayUserTraces,
};