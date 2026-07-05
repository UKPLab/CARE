'use strict';

const { resolveRecordings } = require('./perf-recordings');

/**
 * Regression mode: replay the given recordings once at concurrency 1 and
 * require that EVERY trace passes. Any failure or ack timeout = regression fail.
 * Returns a process exit code (0 = pass, 1 = fail) so it works as a CI gate.
 * @param {Object} cfg
 * @param {Object} ctx - { emitWithAck, userId }
 * @returns {Promise<number>}
 */
async function runRegression(cfg, ctx) {
    const ids = await resolveRecordings(cfg, ctx);
    console.log('  regression recordings: ' + ids.join(', '));

    console.log('Running regression (replay once, all traces must pass) ...');
    const ack = await ctx.emitWithAck('replayRun', {
        recordingIds: ids,
        timingMode: 'fast',
        continueOnFailure: true,   // run all stories so we report every failure, not just the first
        maxIterations: 1,          // once — no scaling
        ackTimeout: cfg.ackTimeout,
    });

    if (!ack || !ack.success) {
        console.error('REGRESSION ERROR — replayRun failed: ' + (ack && ack.message));
        return 1;
    }

    // ack.data is the iteration results array. maxIterations=1 => one iteration.
    const iterations = ack.data || [];
    const failures = [];
    let totalTraces = 0;

    for (const iter of iterations) {
        for (const session of (iter.results || [])) {
            totalTraces += session.total || 0;
            for (const err of (session.errors || [])) {
                failures.push({
                    recording: session.recordingName || session.recordingId,
                    action: err.action,
                    message: err.message,
                });
            }
        }
    }

    console.log('');
    if (failures.length === 0) {
        console.log(`REGRESSION PASSED — all ${totalTraces} trace(s) passed.`);
        return 0;
    }
    console.log(`REGRESSION FAILED — ${failures.length} of ${totalTraces} trace(s) failed:`);
    for (const f of failures) {
        console.log(`  [${f.recording}] ${f.action}: ${f.message}`);
    }
    return 1;
}

module.exports = { runRegression };