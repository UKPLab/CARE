'use strict';

const { resolvePayload } = require('./perf-recordings');
const { printTraceStats } = require('./perf-trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./perf-report');

/**
 * Regression mode: replay the given recordings once at concurrency 1 and
 * require that EVERY trace passes. Any failure or ack timeout = regression fail.
 * Returns a process exit code (0 = pass, 1 = fail) so it works as a CI gate.
 * @param {Object} cfg
 * @param {Object} ctx - { emitWithAck, userId }
 * @returns {Promise<number>}
 */
async function runRegression(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    console.log('  regression input: ' + (sessions.length ? `${sessions.length} file session(s)` : recordingIds.join(', ')));

    console.log('Running regression (replay once, all traces must pass) ...');
    const ack = await ctx.emitWithAck('replayRun', {
        recordingIds,
        sessions,
        timingMode: 'fast',
        continueOnFailure: true,   // run all stories so we report every failure, not just the first
        maxIterations: 1,          // once — no scaling
        ackTimeout: cfg.ackTimeout,
    },0);

    if (!ack || !ack.success) {
        console.error('REGRESSION ERROR — replayRun failed: ' + (ack && ack.message));
        return 1;
    }

    // ack.data is the iteration results array. maxIterations=1 => one iteration.
    const iterations = ack.data || [];

    // Group results per recording (per user story) so we can report which
    // stories pass and which fail — the "is this version stable?" verdict.
    const stories = new Map();  // key: recording name/id -> { total, failed, errors[] }
    for (const iter of iterations) {
        for (const session of (iter.results || [])) {
            const key = session.recordingName || ('recording ' + session.recordingId);
            if (!stories.has(key)) stories.set(key, { total: 0, failed: 0, errors: [] });
            const s = stories.get(key);
            s.total += session.total || 0;
            s.failed += session.failed || 0;
            for (const err of (session.errors || [])) {
                s.errors.push({ action: err.action, message: err.message });
            }
        }
    }

    console.log('');
    let passedStories = 0, failedStories = 0;
    for (const [name, s] of stories) {
        if (s.failed === 0) {
            console.log(`  [PASS] ${name}  (${s.total} traces)`);
            passedStories++;
        } else {
            console.log(`  [FAIL] ${name}  (${s.failed} of ${s.total} traces failed)`);
            failedStories++;
        }
    }

    const totalStories = stories.size;
    console.log('');
    if (failedStories === 0) {
        console.log(`REGRESSION SUITE PASSED — all ${totalStories} story recording(s) passed.`);
        console.log('Version is STABLE.');
        const saved = saveResults('regression', cfg, {
            results: iterations.flatMap(i => i.results || []),
            verdict: 'stable',
        });
        const text = capture.stop();
        if (saved) {
            const txt = saveReadableReport(saved, text);
            console.log(`\n  results saved: ${saved}`);
            if (txt) console.log(`  readable report: ${txt}`);
        }
        return 0;
    }
    console.log(`REGRESSION SUITE FAILED — ${passedStories} of ${totalStories} stories passed, ${failedStories} failed.`);
    for (const [name, s] of stories) {
        if (s.failed > 0) {
            console.log(`  Failed: ${name}`);
            for (const e of s.errors.slice(0, 3)) console.log(`    - ${e.action}: ${e.message}`);
            if (s.errors.length > 3) console.log(`    ... and ${s.errors.length - 3} more`);
        }
    }
    printTraceStats(iterations.flatMap(i => i.results || []), { title: 'Trace breakdown (all stories):' });
    console.log('Version is NOT stable.');
    const saved = saveResults('regression', cfg, {
        results: iterations.flatMap(i => i.results || []),
        verdict: 'not stable',
    });
    const text = capture.stop();
    if (saved) {
        const txt = saveReadableReport(saved, text);
        console.log(`\n  results saved: ${saved}`);
        if (txt) console.log(`  readable report: ${txt}`);
    }
    return 1;
}

module.exports = { runRegression };