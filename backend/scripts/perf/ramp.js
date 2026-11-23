'use strict';

const { randomUUID } = require('crypto');
const { resolvePayload } = require('./utils/recordings');
const { MetricSampler } = require('./utils/metrics');
const { printTraceStats } = require('./utils/trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./utils/report');
const {
    levelMetrics, printLevelHeader, printLevelRow, printRequestTotals, printVitals, printReadingNotes,
} = require('./utils/summary');

/**
 * Ramp mode: the server climbs N, 2N, 3N ... sessions (N = sessions in the
 * pool) up to --max-iterations, stopping early on the first failed request or
 * when a level's p95 exceeds --latency-threshold. This reports every level and
 * why the climb ended. Reports only; it does not judge the result.
 * @param {Object} cfg - Run configuration; reads maxIterations (levels to climb), ackTimeout, latencyThreshold (p95 stop condition), continueOnFailure, and the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<number>} Exit code: 0 when the run completed, 1 when the tool could not run it or the server connection dropped
 */
async function runRamp(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    console.log('  ramp input: ' + (sessions.length ? `${sessions.length} file session(s)` : `recordings ${recordingIds.join(', ')}`));
    console.log(`Running ramp: up to ${cfg.maxIterations} levels (ack timeout ${cfg.ackTimeout}ms) ...`);

    const progressId = randomUUID();
    const onProgress = (data) => {
        if (data.id !== progressId) {
            return;
        }
        const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
        process.stdout.write(`\r  progress: ${pct}% (${data.current}/${data.total} requests)   `);
    };
    ctx.socket.on('progressUpdate', onProgress);

    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    await sampler.start();

    let ack;
    // Set when the server connection drops mid-run; the report is still printed and saved.
    let lostConnection = null;
    try {
        ack = await ctx.emitWithAck('replayRun', {
            recordingIds,
            sessions,
            timingMode: 'fast',
            continueOnFailure: cfg.continueOnFailure ?? false,
            maxIterations: cfg.maxIterations,
            ackTimeout: cfg.ackTimeout,
            progressId,
            latencyThreshold: cfg.latencyThreshold,
            notifyOnStop: false,       // no browser here; the outcome comes back in the ack
        }, 0);
    } catch (err) {
        lostConnection = err.message;
    } finally {
        ctx.socket.off('progressUpdate', onProgress);
        await sampler.stop();
    }

    process.stdout.write('\n');

    if (lostConnection) {
        console.error('RAMP STOPPED — ' + lostConnection);
        const summary = printLostConnectionReport(lostConnection, sampler);
        saveAndClose(cfg, capture, { results: [], metrics: [], sampler, summary });
        return 1;
    }

    if (!ack || !ack.success) {
        console.error('RAMP ERROR — replayRun failed: ' + (ack && ack.message));
        capture.stop();
        return 1;
    }

    const levels = ack.data || [];
    const summary = printRampReport(levels, cfg, sampler);

    saveAndClose(cfg, capture, {
        results: levels.flatMap(l => l.results || []),
        metrics: levels.map(({ results, ...rest }) => ({ ...rest, ...levelMetrics(results, rest.duration) })),
        sampler,
        summary,
    });
    return 0;
}

/**
 * Save the run's JSON and readable report, and stop capturing the terminal output.
 * @param {Object} cfg - Run configuration, recorded in the JSON
 * @param {Object} capture - Output capture from makeOutputCapture, already started
 * @param {Object} payload - Passed to saveResults: { results, metrics, sampler, summary }
 * @returns {void}
 */
function saveAndClose(cfg, capture, payload) {
    const saved = saveResults('ramp', cfg, payload);
    const text = capture.stop();
    if (saved) {
        const txt = saveReadableReport(saved, text);
        console.log(`\n  results saved: ${saved}`);
        if (txt) {
            console.log(`  readable report: ${txt}`);
        }
    }
}

/**
 * Print the report for a ramp whose server connection dropped. The server
 * returns every level in one final reply, so no level results reached the
 * CLI; only the vitals sampled until the drop are reported.
 * @param {string} reason - Why the connection was lost
 * @param {Object} sampler - Stopped MetricSampler
 * @returns {Object} Summary saved in the JSON
 */
function printLostConnectionReport(reason, sampler) {
    console.log('');
    console.log('=== Ramp report ===');
    console.log(`  Ended early: ${reason}.`);
    console.log('  Ramp receives its level results in one reply at the end, so none arrived; the vitals below cover the run until the drop.');
    printVitals(sampler);
    printReadingNotes();
    return { levels: 0, lastSessions: 0, endedBecause: `lost the server connection: ${reason}` };
}

/**
 * Print the ramp report: one row per level, why the climb ended, request
 * totals, server vitals and per-action stats at the last level.
 * @param {Array<Object>} levels - Per-level results from replayRun ({level, sessions, results, passed, duration, p95})
 * @param {Object} cfg - Run configuration; reads maxIterations, latencyThreshold and continueOnFailure
 * @param {Object} sampler - Stopped MetricSampler
 * @returns {Object} Summary saved in the JSON: levels run, last session count and why it ended
 */
function printRampReport(levels, cfg, sampler) {
    console.log('');
    console.log('=== Ramp report ===');
    printLevelHeader([['level', 5]]);
    for (const lvl of levels) {
        printLevelRow([[lvl.level, 5]], levelMetrics(lvl.results, lvl.duration));
    }

    const last = levels[levels.length - 1];
    let endedBecause = 'no levels ran';
    if (last && !last.passed && !cfg.continueOnFailure) {
        endedBecause = `level ${last.level} had failed requests (ramp stops on the first failed request)`;
    } else if (last && levels.length < cfg.maxIterations) {
        endedBecause = `level ${last.level} p95 latency ${last.p95}ms was above --latency-threshold ${cfg.latencyThreshold}ms`;
    } else if (last) {
        endedBecause = `ran all ${last.level} levels`;
    }
    console.log('');
    console.log(`  Ended: ${endedBecause}.`);
    console.log('  Note: ramp does not stop on "no reply" — read the noAck column.');

    console.log('');
    printRequestTotals(levels.flatMap(l => l.results || []));
    printVitals(sampler);
    if (last && last.results) {
        printTraceStats(last.results, { title: `Per-action stats at the last level (${last.sessions} sessions):` });
    }
    printReadingNotes();

    return {
        levels: levels.length,
        lastSessions: last ? last.sessions : 0,
        endedBecause,
    };
}

module.exports = { runRamp };
