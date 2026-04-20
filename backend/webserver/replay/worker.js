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
            resolve({ success: true, timedOut: true });
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
 * @returns {Promise<Object>} Results with pass/fail counts, errors, and latencies
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
        let prevTime = traces.length > 0 ? new Date(traces[0].startTime).getTime() : 0;

        for (const trace of traces) {
            console.log(`[replay] trace ${results.passed + results.failed + 1}/${traces.length}: ${trace.action}`);
            if (timingMode === 'realtime') {
                const traceTime = new Date(trace.startTime).getTime();
                const delay = traceTime - prevTime;
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                prevTime = traceTime;
            }

            try {
                const start = Date.now();
                const ack = await emitWithTimeout(client, trace.action, trace.payload, 2000);
                const latency = Date.now() - start;

                results.latencies.push({ traceId: trace.id, action: trace.action, latency });

                if (ack && ack.success === false) {
                    results.failed++;
                    results.errors.push({
                        traceId: trace.id,
                        action: trace.action,
                        message: ack.message || 'Server returned success: false',
                    });
                } else {
                    results.passed++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push({
                    traceId: trace.id,
                    action: trace.action,
                    message: err.message,
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