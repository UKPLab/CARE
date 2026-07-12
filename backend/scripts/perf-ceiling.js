'use strict';

const { resolvePayload } = require('./perf-recordings');
const { randomUUID } = require('crypto');
const { MetricSampler } = require('./perf-metrics');
const { printTraceStats } = require('./perf-trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./perf-report');

/**
 * Ceiling finder: climb concurrency by --step each level, no cap, until a stop
 * condition trips (trace failure or p95 latency over threshold). Reports the
 * max concurrency the server sustained. Drives escalation one level at a time
 * via replayRun's singleLevel mode.
 * @param {Object} cfg
 * @param {Object} ctx
 * @returns {Promise<number>}
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
    let poolWaitingBaseline = 0;

    while (true) {
        level++;
        const progressId = randomUUID();
        const onProgress = (data) => {
            if (data.id !== progressId) return;
            const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
            process.stdout.write(`\r  level ${level} (concurrency ${concurrency}): ${pct}%   `);
        };
        ctx.socket.on('progressUpdate', onProgress);

        const ack = await ctx.emitWithAck('replayRun', {
            recordingIds,
            sessions,
            timingMode: 'fast',
            ackTimeout: cfg.ackTimeout,
            singleLevel: concurrency,
            progressId,
        }, 0);

        ctx.socket.off('progressUpdate', onProgress);
        process.stdout.write('\r' + ' '.repeat(50) + '\r');  // clear the progress line

        if (!ack || !ack.success) {
            await sampler.stop();
            console.error('\nCEILING ERROR — replayRun failed: ' + (ack && ack.message));
            capture.stop();d
            return 1;
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

            // Name the likely culprit, scoped to WHY it stopped, with clear p95 labeling.
            const culpritStats = require('./perf-trace-stats').traceStats(ack.data.results);
            if (culpritStats.length) {
                if (m.failed > allowedFailures) {
                    const worst = culpritStats.filter(s => s.failed > 0).sort((a, b) => b.failed - a.failed)[0];
                    if (worst) console.log(`\n  >> Likely culprit: ${worst.action} — ${worst.failed} failure(s). Start here.`);
                } else if (poolSaturated) {
                    const worst = [...culpritStats].sort((a, b) => b.dbWrites - a.dbWrites)[0];
                    if (worst) console.log(`\n  >> Likely culprit: ${worst.action} — most DB writes (${worst.dbWrites}), likely saturating the pool. Start here.`);
                } else {
                    const worst = [...culpritStats].sort((a, b) => b.p95 - a.p95)[0];
                    if (worst) console.log(`\n  >> Slowest action: ${worst.action} (its OWN p95: ${worst.p95}ms). Overall level p95 was ${m.p95}ms — this action is dragging it up. Start here.`);
                }
            }
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
            return 0;
        }

        lastGood = concurrency;
        if (level >= hardCap) {
            await sampler.stop();
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

            return 0;
        }
        concurrency += step;
    }
}

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

function pad(v, w) { return String(v).padEnd(w); }

module.exports = { runCeiling };