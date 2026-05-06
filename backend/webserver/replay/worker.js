'use strict';

const { createAuthenticatedClient, cleanupSession } = require('./auth');

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

        client.emit(action, payload || {}, (response) => {
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
 * @returns {Promise<Object>} Results with pass/fail counts, errors, latencies, and DB changes
 */
async function replayUserTraces(server, user, traces, serverUrl, timingMode) {
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

            try {
                const start = Date.now();
                const ack = await emitWithTimeout(client, trace.action, trace.payload, 2000);
                const latency = Date.now() - start;

                // Small delay to let any remaining Refresh events arrive
                await new Promise(resolve => setTimeout(resolve, 50));
                if (pendingDbChanges.length > 0) {
                    console.log(`[replay] trace ${trace.action} caused ${pendingDbChanges.length} DB changes`);
                }

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
                        traceId: trace.id,
                        action: trace.action,
                        latency,
                        dbChanges,
                    });
                }
            } catch (err) {
                results.failed++;
                results.errors.push({
                    traceId: trace.id,
                    action: trace.action,
                    message: err.message,
                    dbChanges: [],
                });
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