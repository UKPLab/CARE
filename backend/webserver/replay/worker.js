'use strict';

const { createAuthenticatedClient, cleanupSession } = require('./auth');

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
 * @returns {Promise<Object>} Server response
 * @throws {Error} If no ack received within timeout
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
 * Replay a single user's traces through an authenticated socket connection.
 * @param {Object} server - CARE server instance
 * @param {Object} user - User row from DB
 * @param {Array<Object>} traces - Trace rows (direction: true only), sorted by startTime
 * @param {string} serverUrl - Target server URL
 * @param {string} timingMode - "realtime" to preserve original delays, "fast" to skip them
 * @param {number} ackTimeout - Max wait time in ms for the server to ack each trace (default 2000)
 * @returns {Promise<Object>} Results with pass/fail counts, errors, latencies, and DB changes
 */
async function replayUserTraces(server, user, traces, serverUrl, timingMode, ackTimeout = 2000, onProgress = null) {
    const results = {
        userId: user.id,
        userName: user.userName,
        total: traces.length,
        passed: 0,
        failed: 0,
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

        client.onAny((eventName, ...args) => {
            if (eventName.endsWith('Refresh')) {
                const records = Array.isArray(args[0]) ? args[0] : [args[0]];
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
                const ack = await emitWithTimeout(client, trace.action, trace.payload, ackTimeout);
                const latency = Date.now() - start;

                // Let any Refresh events triggered by this trace arrive before
                // we snapshot them; anything slower than this window is missed.
                await new Promise(resolve => setTimeout(resolve, DB_CHANGE_WINDOW_MS));
                const dbChanges = [...pendingDbChanges];

                if (ack && ack.success === false) {
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