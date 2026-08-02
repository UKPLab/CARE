'use strict';

const { resolvePayload } = require('./utils/recordings');
const { randomUUID } = require('crypto');
const { MetricSampler } = require('./utils/metrics');
const { printTraceStats, printCulprit } = require('./utils/trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./utils/report');

/**
 * Ceiling finder: climb concurrency by --step each level, no cap, until a stop
 * condition trips (trace failure or p95 latency over threshold). Reports the
 * max concurrency the server sustained. Drives escalation one level at a time
 * via replayRun's singleLevel mode.
 * @param {Object} cfg
 * @param {Object} ctx
 * @returns {Promise<{code: number, maxConcurrency: number}>} Exit code (0 ok, 1 error) and the max concurrency the server sustained (lastGood)
 */
async function runCeiling(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    const step = cfg.step > 0 ? cfg.step : 5;
    const hardCap = cfg.maxIterations > 0 ? cfg.maxIterations : Infinity;

    console.log('  ceiling input: ' + (sessions.length ? `${sessions.length} file session(s)` : recordingIds.join(', ')));
    console.log(`Climbing concurrency by ${step} each level until failure or p95 > ${cfg.latencyThreshold}ms ...`);
    console.log('  level  concurrency  passed  failed  avgMs  p95Ms  thru/s  wait  status');

    let concurrency = step;
    let level = 0;
    let lastGood = 0;
    const allLevels = [];

    // Sample server vitals continuously through the climb (approach a). After
    // each level we read the peak pool-waiting since the last level — the DB
    // pool backing up is the original pool-exhaustion failure, measured directly.
    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    sampler.start();
    // Capture the pool's idle waiting level before applying load, so saturation
    // means "climbed above resting" rather than "above zero" — some deployments
    // idle with non-zero pool waiting.
    let poolWaitingBaseline = sampler.latestPoolWaiting();
    let stopped = false;

    try {
    while (true) {
        level++;
        const progressId = randomUUID();
        const onProgress = (data) => {
            if (data.id !== progressId) return;
            const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
            process.stdout.write(`\r  level ${level} (concurrency ${concurrency}): ${pct}%   `);
        };
        ctx.socket.on('progressUpdate', onProgress);

        let ack;
        try {
            ack = await ctx.emitWithAck('replayRun', {
                recordingIds,
                sessions,
                timingMode: 'fast',
                ackTimeout: cfg.ackTimeout,
                singleLevel: concurrency,
                progressId,
            }, 0);
        } finally {
            ctx.socket.off('progressUpdate', onProgress);
        }

        process.stdout.write('\r' + ' '.repeat(50) + '\r');  // clear the progress line

        if (!ack || !ack.success) {
            await sampler.stop();
            stopped = true;
            console.error('\nCEILING ERROR — replayRun failed: ' + (ack && ack.message));
            capture.stop();
            return { code: 1, maxConcurrency: lastGood };
        }

        const m = metrics(ack.data);
        allLevels.push({ level, concurrency, ...m, results: ack.data.results });

        // Pool-waiting: the DB pool backing up = pool exhaustion (the original
        // failure). Read the peak since we started; if it climbed above 0, the
        // pool saturated at this concurrency.
        const peakWaiting = sampler.peakPoolWaiting();
        const poolSaturated = peakWaiting > poolWaitingBaseline && peakWaiting > 0;

        const allowedFailures = cfg.maxFailures || 0;
        const tripped = m.failed > allowedFailures || m.p95 > cfg.latencyThreshold || poolSaturated;
        const status = tripped ? 'STOP' : 'ok';
        console.log(`  ${pad(level, 5)}  ${pad(concurrency, 11)}  ${pad(m.passed, 6)}  ${pad(m.failed, 6)}  ${pad(m.avg, 5)}  ${pad(m.p95, 5)}  ${pad(m.thru, 6)}  ${pad(peakWaiting, 4)}  ${status}`);

        if (tripped) {
            let reason;
            if (poolSaturated) reason = `DB pool saturated (waiting peaked at ${peakWaiting})`;
            else if (m.failed > allowedFailures) reason = `${m.failed} trace failure(s) (allowed: ${allowedFailures})`;
            else reason = `overall p95 latency ${m.p95}ms > ${cfg.latencyThreshold}ms threshold`;
            await sampler.stop();
            stopped = true;
            console.log(`\nCEILING: server sustained ${lastGood} concurrent sessions; degraded at ${concurrency} (${reason}).`);
            {
                const rssMb = (b) => Math.round(b / 1024 / 1024);
                const rss = sampler.rssTrend();
                const heap = sampler.heapTrend();
                console.log(`  memory (RSS):  ${rssMb(rss.first)}MB -> ${rssMb(rss.last)}MB, peak ${rssMb(sampler.peakRss())}MB`);
                console.log(`  memory (heap): ${rssMb(heap.first)}MB -> ${rssMb(heap.last)}MB, peak ${rssMb(sampler.peakHeap())}MB`);
                const pg = sampler.pgStatsSummary();
                if (pg) {
                    console.log(`  Postgres: deadlocks +${pg.deadlocksDelta}, rollbacks +${pg.rollbacksDelta}, peak lock-waits ${pg.peakLockWaits}` +
                        (pg.minCacheHit != null ? `, min cache-hit ${pg.minCacheHit.toFixed(1)}%` : ''));
                }
            }
            printTraceStats(ack.data.results, { title: `Trace breakdown at level ${concurrency} (each action's OWN stats):` });

            // Name the likely culprit, scoped to why it stopped.
            printCulprit(ack.data.results, {
                failed: m.failed > allowedFailures,
                poolSaturated,
                overallP95: m.p95,
            });
            const saved = saveResults('ceiling', cfg, {
                results: allLevels.flatMap(l => l.results || []),
                metrics: allLevels.map(({ results, ...rest }) => rest),
                sampler,
                verdict: `degraded at ${concurrency} (${reason})`,
            });
            const text = capture.stop();
            if (saved) {
                const txt = saveReadableReport(saved, text);
                console.log(`\n  results saved: ${saved}`);
                if (txt) console.log(`  readable report: ${txt}`);
            }
            return { code: 0, maxConcurrency: lastGood };
        }

        lastGood = concurrency;
        if (level >= hardCap) {
            await sampler.stop();
            stopped = true;
            console.log(`\nCEILING: hit safety cap (${hardCap} levels) at ${concurrency} sessions, still healthy — raise --max-iterations or lower --latency-threshold to push further.`);
            {
                const rssMb = (b) => Math.round(b / 1024 / 1024);
                const rss = sampler.rssTrend();
                const heap = sampler.heapTrend();
                console.log(`  memory (RSS):  ${rssMb(rss.first)}MB -> ${rssMb(rss.last)}MB, peak ${rssMb(sampler.peakRss())}MB`);
                console.log(`  memory (heap): ${rssMb(heap.first)}MB -> ${rssMb(heap.last)}MB, peak ${rssMb(sampler.peakHeap())}MB`);
                const pg = sampler.pgStatsSummary();
                if (pg) {
                    console.log(`  Postgres: deadlocks +${pg.deadlocksDelta}, rollbacks +${pg.rollbacksDelta}, peak lock-waits ${pg.peakLockWaits}` +
                        (pg.minCacheHit != null ? `, min cache-hit ${pg.minCacheHit.toFixed(1)}%` : ''));
                }
            }

            const saved = saveResults('ceiling', cfg, {
                results: allLevels.flatMap(l => l.results || []),
                metrics: allLevels.map(({ results, ...rest }) => rest),
                sampler,
                verdict: `hit safety cap at ${concurrency}, still healthy`,
            });
            const text = capture.stop();
            if (saved) {
                const txt = saveReadableReport(saved, text);
                console.log(`\n  results saved: ${saved}`);
                if (txt) console.log(`  readable report: ${txt}`);
            }

            return { code: 0, maxConcurrency: lastGood };
        }
        concurrency += step;
    }
    } finally {
        if (!stopped) await sampler.stop();
    }
}

/**
 * Aggregate one replay level's session results into summary metrics.
 * @param {Object} lvl - One level's replay result ({results: Array<Object>, duration: number})
 * @returns {{passed: number, failed: number, avg: number, p95: number, thru: number}} Trace pass/fail counts, average and 95th-percentile latency in ms, and throughput in traces per second
 */
function metrics(lvl) {
    let passed = 0, failed = 0;
    const lats = [];
    for (const s of (lvl.results || [])) {
        passed += s.passed || 0;
        failed += s.failed || 0;
        for (const l of (s.latencies || [])) lats.push(l.latency);
    }
    lats.sort((a, b) => a - b);
    const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
    const p95 = lats.length ? Math.round(lats[Math.min(lats.length - 1, Math.floor(0.95 * lats.length))]) : 0;
    const durSec = (lvl.duration || 0) / 1000;
    const thru = durSec > 0 ? Math.round((passed + failed) / durSec) : 0;
    return { passed, failed, avg, p95, thru };
}

/**
 * Right-pad a value to a fixed width for aligned table output.
 * @param {*} v - Value to pad (coerced to string)
 * @param {number} w - Target column width
 * @returns {string} The padded string
 */
function pad(v, w) { return String(v).padEnd(w); }

module.exports = { runCeiling };