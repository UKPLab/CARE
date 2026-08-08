'use strict';

const { resolvePayload } = require('./utils/recordings');
const { printTraceStats } = require('./utils/trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./utils/report');

/**
 * Regression mode: replay the given recordings once at concurrency 1 and
 * require that EVERY trace passes. Any failure or ack timeout = regression fail.
 * Returns a process exit code (0 = pass, 1 = fail) so it works as a CI gate.
 * @param {Object} cfg - Run configuration; reads ackTimeout and the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<number>}
 */
async function runRegression(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    console.log('  regression input: ' + (sessions.length ? `${sessions.length} file session(s)` : recordingIds.join(', ')));

    console.log('Running regression (replay once, all traces must pass) ...');
    let ack;
    const onProgress = ({ id, current, total }) => {
        if (id !== 'regression' || !total) {
            return;
        }
        const pct = Math.floor((current / total) * 100);
        process.stdout.write(`\r  replaying ${current}/${total} traces (${pct}%)   `);
    };
    ctx.socket.on('progressUpdate', onProgress);

    const clearProgress = () => {
        ctx.socket.off('progressUpdate', onProgress);
        process.stdout.write('\r' + ' '.repeat(50) + '\r');
    };

    try {
        ack = await ctx.emitWithAck('replayRun', {
            recordingIds,
            sessions,
            timingMode: 'fast',
            continueOnFailure: true,   // run all stories so we report every failure, not just the first
            maxIterations: 1,          // once — no scaling
            progressId: 'regression',
            sequential: true,          // one story at a time so created rows get predictable ids
            ackTimeout: cfg.ackTimeout,
        }, 0);
    } catch (err) {
        capture.stop();
        console.error('REGRESSION ERROR — replayRun threw: ' + err.message);
        clearProgress();
        return 1;
    }

    if (!ack || !ack.success) {
        capture.stop();
        console.error('REGRESSION ERROR — replayRun failed: ' + (ack && ack.message));
        clearProgress();
        return 1;
    }

    clearProgress();

    // ack.data is the iteration results array. maxIterations=1 => one iteration.
    const iterations = ack.data || [];

    // Group results per recording (per user story) so we can report which
    // stories pass and which fail — the "is this version stable?" verdict.
    // Group by a stable identity, not the display name: recordingName can repeat
    // across recordings (and file replay defaults it to 'file'), which would merge
    // distinct recordings. recordingId groups a recording's sessions together for
    // DB replay; file replay has no id (null), so fall back to the unique
    // sessionKey there. recordingName is kept only for display.
    const stories = new Map();  // key: recordingId ?? sessionKey -> { name, total, failed, errors[] }
    for (const iter of iterations) {
        for (const session of (iter.results || [])) {
            const key = session.recordingId != null ? `id:${session.recordingId}` : `key:${session.sessionKey}`;
            if (!stories.has(key)) {
                stories.set(key, {
                    name: session.recordingName || ('recording ' + (session.recordingId ?? session.sessionKey)),
                    total: 0,
                    failed: 0,
                    errors: [],
                });
            }
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
    for (const [, s] of stories) {
        if (s.failed === 0) {
            console.log(`  [PASS] ${s.name}  (${s.total} traces)`);
            passedStories++;
        } else {
            console.log(`  [FAIL] ${s.name}  (${s.failed} of ${s.total} traces failed)`);
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
    for (const [, s] of stories) {
        if (s.failed > 0) {
            console.log(`  Failed: ${s.name}`);
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