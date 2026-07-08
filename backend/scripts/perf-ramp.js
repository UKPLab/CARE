'use strict';

const { resolveRecordings } = require('./perf-recordings');
const { randomUUID } = require('crypto');
const { printTraceStats, printCulprit } = require('./perf-trace-stats');

/**
 * Ramp mode: escalate concurrency (N, 2N, 3N...) until a hard failure or the
 * iteration cap, then report the degradation curve. The server (replayRun)
 * already does the escalation and stops on failure; this reads the results and
 * computes/prints the per-level metrics + verdict.
 * @param {Object} cfg
 * @param {Object} ctx - { emitWithAck }
 * @returns {Promise<number>} exit code (0 = reached cap clean, 1 = broke early)
 */
async function runRamp(cfg, ctx) {
    const ids = await resolveRecordings(cfg, ctx);
    console.log('  ramp recordings: ' + ids.join(', '));
    console.log(`Running ramp: up to ${cfg.maxIterations} iterations, stop on failure ...`);

    const progressId = randomUUID();
    const onProgress = (data) => {
        if (data.id !== progressId) return;
        const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
        process.stdout.write(`\r  progress: ${pct}% (${data.current}/${data.total} traces)   `);
    };
    ctx.socket.on('progressUpdate', onProgress);

    const ack = await ctx.emitWithAck('replayRun', {
        recordingIds: ids,
        timingMode: 'fast',
        continueOnFailure: false,
        maxIterations: cfg.maxIterations,
        ackTimeout: cfg.ackTimeout,
        progressId,
        latencyThreshold: cfg.latencyThreshold,
    }, 0);

    ctx.socket.off('progressUpdate', onProgress);
    process.stdout.write('\n');

    if (!ack || !ack.success) {
        console.error('RAMP ERROR — replayRun failed: ' + (ack && ack.message));
        return 1;
    }

    const levels = ack.data || [];
    reportRamp(levels, cfg);

    // Exit non-zero if it broke before the cap (a failing level).
    const brokeEarly = levels.length > 0 && !levels[levels.length - 1].passed;
    return brokeEarly ? 1 : 0;
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

function reportRamp(levels, cfg) {
    console.log('\n=== Ramp results ===');
    console.log('  level  sessions  passed  failed  avgMs  p95Ms  maxMs  thru/s  status');

    for (const lvl of levels) {
        const sessions = lvl.results || [];
        let totalTraces = 0, failedTraces = 0;
        const lats = [];
        for (const s of sessions) {
            totalTraces += s.total || 0;
            failedTraces += s.failed || 0;
            for (const l of (s.latencies || [])) lats.push(l.latency);
        }
        lats.sort((a, b) => a - b);
        const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
        const p95 = Math.round(percentile(lats, 95));
        const max = lats.length ? lats[lats.length - 1] : 0;
        const durSec = (lvl.duration || 0) / 1000;
        const thru = durSec > 0 ? Math.round(totalTraces / durSec) : 0;
        const status = lvl.passed ? 'ok' : 'FAIL';

        console.log(
            `  ${String(lvl.level).padEnd(5)}  ${String(lvl.sessions).padEnd(8)}  ` +
            `${String(totalTraces - failedTraces).padEnd(6)}  ${String(failedTraces).padEnd(6)}  ` +
            `${String(avg).padEnd(5)}  ${String(p95).padEnd(5)}  ${String(max).padEnd(5)}  ` +
            `${String(thru).padEnd(6)}  ${status}`
        );

    }

    const lastLevel = levels[levels.length - 1];
    if (lastLevel && lastLevel.results) {
        printTraceStats(lastLevel.results, { title: `Trace breakdown at final level (${lastLevel.sessions} sessions):` });
    }

    // Verdict.
    const last = levels[levels.length - 1];
    console.log('');
    if (last && !last.passed) {
        console.log(`RAMP: broke at iteration ${last.level} (${last.sessions} concurrent sessions) — trace failures.`);
    } else if (last && levels.length < cfg.maxIterations) {
        console.log(`RAMP: stopped at iteration ${last.level} (${last.sessions} sessions) — p95 latency ${last.p95}ms exceeded threshold ${cfg.latencyThreshold}ms.`);
    } else if (last) {
        console.log(`RAMP: reached cap of ${last.level} iterations (${last.sessions} sessions) with no failure or latency breach.`);
        if (levels.length > 1) {
            const firstLat = avgLatency(levels[0]), lastLat = avgLatency(last);
            console.log(`      avg latency went from ${firstLat}ms (iter 1) to ${lastLat}ms (iter ${last.level}).`);
        }
    }
}

function avgLatency(level) {
    const lats = [];
    for (const s of (level.results || [])) for (const l of (s.latencies || [])) lats.push(l.latency);
    return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
}

module.exports = { runRamp };