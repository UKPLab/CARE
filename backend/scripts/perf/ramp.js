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
 * @returns {Promise<number>} Exit code: 0 when the run completed, 1 when the tool could not run it
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
    } finally {
        ctx.socket.off('progressUpdate', onProgress);
        await sampler.stop();
    }

    process.stdout.write('\n');

    if (!ack || !ack.success) {
        console.error('RAMP ERROR — replayRun failed: ' + (ack && ack.message));
        capture.stop();
        return 1;
    }

    const levels = ack.data || [];
    const summary = printRampReport(levels, cfg, sampler);

    const saved = saveResults('ramp', cfg, {
        results: levels.flatMap(l => l.results || []),
        metrics: levels.map(({ results, ...rest }) => ({ ...rest, ...levelMetrics(results, rest.duration) })),
        sampler,
        summary,
    });
    const text = capture.stop();
    if (saved) {
        const txt = saveReadableReport(saved, text);
        console.log(`\n  results saved: ${saved}`);
        if (txt) {
            console.log(`  readable report: ${txt}`);
        }
    }
    return 0;
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
