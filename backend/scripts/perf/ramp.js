'use strict';

const { resolvePayload } = require('./utils/recordings');
const { randomUUID } = require('crypto');
const { printTraceStats } = require('./utils/trace-stats');
const { MetricSampler } = require('./utils/metrics');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./utils/report');

/**
 * Ramp mode: escalate concurrency (N, 2N, 3N...) until a hard failure or the
 * iteration cap, then report the degradation curve. The server (replayRun)
 * already does the escalation and stops on failure; this reads the results and
 * computes/prints the per-level metrics + verdict.
 * @param {Object} cfg - Run configuration; reads maxIterations (levels to climb), ackTimeout, latencyThreshold (p95 stop condition), timingMode, and the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<number>} exit code (0 = reached cap clean, 1 = broke early)
 */
async function runRamp(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    console.log('  ramp input: ' + (sessions.length ? `${sessions.length} file session(s)` : `recordings ${recordingIds.join(', ')}`));
    console.log(`Running ramp: up to ${cfg.maxIterations} iterations, stop on failure ...`);

    const progressId = randomUUID();
    const onProgress = (data) => {
        if (data.id !== progressId) return;
        const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
        process.stdout.write(`\r  progress: ${pct}% (${data.current}/${data.total} traces)   `);
    };
    ctx.socket.on('progressUpdate', onProgress);

    // Sample server vitals (memory + DB pool) during the whole ramp climb.
    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    await sampler.start();

    let ack;
    try {
        // The previously broken/duplicate emitWithAck call, now restored
        ack = await ctx.emitWithAck('replayRun', {
            recordingIds,
            sessions,
            timingMode: 'fast',
            continueOnFailure: cfg.continueOnFailure ?? false,
            maxIterations: cfg.maxIterations,
            ackTimeout: cfg.ackTimeout,
            progressId,
            latencyThreshold: cfg.latencyThreshold,
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
    reportRamp(levels, cfg, sampler);

    // Exit non-zero if it broke before the cap (a failing level).
    const brokeEarly = levels.length > 0 && !levels[levels.length - 1].passed;
    const saved = saveResults('ramp', cfg, {
        results: levels.flatMap(l => l.results || []),
        metrics: levels,
        sampler,
        verdict: brokeEarly ? 'broke' : 'clean',
    });
    const text = capture.stop();
    if (saved) {
        const txt = saveReadableReport(saved, text);
        console.log(`\n  results saved: ${saved}`);
        if (txt) console.log(`  readable report: ${txt}`);
    }
    return brokeEarly ? 1 : 0;
}

/**
 * Read a percentile value from a pre-sorted numeric array.
 * @param {Array<number>} sorted - Values sorted ascending
 * @param {number} p - Percentile to read (0-100)
 * @returns {number} The value at that percentile, or 0 if the array is empty
 */
function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

/**
 * Print the ramp results table, memory and DB vitals, and the final verdict.
 * @param {Array<Object>} levels - Per-level replay results from replayRun
 * @param {Object} cfg - Run configuration; reads maxIterations and latencyThreshold to phrase the final verdict
 * @param {Object} sampler - Stopped MetricSampler; read for rss/heap trends, pool waiting, and Postgres stat deltas
 * @returns {void}
 */
function reportRamp(levels, cfg, sampler) {
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

    if (sampler) {
        const rssMb = (b) => Math.round(b / 1024 / 1024);
        const rss = sampler.rssTrend();
        const heap = sampler.heapTrend();
        console.log(`\n  memory (RSS):  ${rssMb(rss.first)}MB -> ${rssMb(rss.last)}MB, peak ${rssMb(sampler.peakRss())}MB`);
        console.log(`  memory (heap): ${rssMb(heap.first)}MB -> ${rssMb(heap.last)}MB, peak ${rssMb(sampler.peakHeap())}MB`);
        console.log(`  DB pool waiting: peak ${sampler.peakPoolWaiting()}`);
        const pg = sampler.pgStatsSummary();
        if (pg) {
            console.log(`  Postgres: deadlocks +${pg.deadlocksDelta}, rollbacks +${pg.rollbacksDelta}, peak lock-waits ${pg.peakLockWaits}` +
                (pg.minCacheHit != null ? `, min cache-hit ${pg.minCacheHit.toFixed(1)}%` : ''));
        }
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

/**
 * Average trace latency across all sessions in one level.
 * @param {Object} level - One level's replay result ({results: Array<Object>})
 * @returns {number} Mean latency in ms, rounded; 0 if the level has no latencies
 */
function avgLatency(level) {
    const lats = [];
    for (const s of (level.results || [])) for (const l of (s.latencies || [])) lats.push(l.latency);
    return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
}

module.exports = { runRamp };