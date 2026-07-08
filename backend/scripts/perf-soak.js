'use strict';

const { randomUUID } = require('crypto');
const { resolveRecordings } = require('./perf-recordings');
const { MetricSampler } = require('./perf-metrics');
const { printTraceStats } = require('./perf-trace-stats');

/**
 * Soak mode: hold a FIXED concurrency continuously for a duration, sampling
 * each batch, and report whether the platform drifts over time (latency creep
 * or failure accumulation at constant load). Reuses replayRun's singleLevel
 * mode to run one fixed-concurrency batch per sample.
 * @param {Object} cfg
 * @param {Object} ctx
 * @returns {Promise<number>} exit code (0 = stable, 1 = drift detected)
 */
async function runSoak(cfg, ctx) {
    const ids = await resolveRecordings(cfg, ctx);
    const durationMs = cfg.duration;
    const concurrency = cfg.concurrency;

    console.log('  soak recordings: ' + ids.join(', '));
    console.log(`Holding ${concurrency} concurrent sessions for ${Math.round(durationMs / 1000)}s, sampling continuously ...`);
    console.log('  sample  elapsed  passed  failed  avgMs  p95Ms  thru/s');

    const start = Date.now();
    const allResults = [];
    const samples = [];
    let sampleNum = 0;
    // Sample server vitals (memory + DB pool) once per second during the soak.
    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    sampler.start();

    while (Date.now() - start < durationMs) {
        sampleNum++;
        const progressId = randomUUID();
        const onProgress = (data) => {
            if (data.id !== progressId) return;
            const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
            process.stdout.write(`\r  sample ${sampleNum}: ${pct}%   `);
        };
        ctx.socket.on('progressUpdate', onProgress);

        const ack = await ctx.emitWithAck('replayRun', {
            recordingIds: ids,
            timingMode: 'fast',
            ackTimeout: cfg.ackTimeout,
            singleLevel: concurrency,
            progressId,
        }, 0);

        ctx.socket.off('progressUpdate', onProgress);
        process.stdout.write('\r' + ' '.repeat(40) + '\r');

        if (!ack || !ack.success) {
            console.error('SOAK ERROR — replayRun failed: ' + (ack && ack.message));
            await sampler.stop();
            return 1;
        }

        const m = metrics(ack.data);
        const elapsedSec = Math.round((Date.now() - start) / 1000);
        samples.push({ ...m, elapsedSec });
        console.log(`  ${pad(sampleNum, 6)}  ${pad(elapsedSec + 's', 7)}  ${pad(m.passed, 6)}  ${pad(m.failed, 6)}  ${pad(m.avg, 5)}  ${pad(m.p95, 5)}  ${pad(m.thru, 6)}`);
        if (ack.data && ack.data.results) allResults.push(...ack.data.results);

        if (cfg.sampleInterval > 0) {
            const remaining = durationMs - (Date.now() - start);
            if (remaining > 0) await sleep(Math.min(cfg.sampleInterval, remaining));  
        }
    }

    await sampler.stop();
    return reportSoak(samples, concurrency, durationMs, sampler, allResults);
}

/**
 * Compare early vs late samples to detect drift over time.
 * @returns {number} exit code
 */
function reportSoak(samples, concurrency, durationMs, sampler, allResults) {
    console.log('');
    if (samples.length < 2) {
        console.log(`SOAK: only ${samples.length} sample(s) — run longer for a trend.`);
        return 0;
    }

    const third = Math.max(1, Math.floor(samples.length / 3));
    const early = samples.slice(0, third);
    const late = samples.slice(-third);
    const avgP95 = (arr) => Math.round(arr.reduce((s, x) => s + x.p95, 0) / arr.length);
    const totalFailed = (arr) => arr.reduce((s, x) => s + x.failed, 0);

    const earlyP95 = avgP95(early), lateP95 = avgP95(late);
    const earlyFail = totalFailed(early), lateFail = totalFailed(late);
    const p95Drift = earlyP95 > 0 ? Math.round(((lateP95 - earlyP95) / earlyP95) * 100) : 0;

    console.log(`SOAK complete: ${samples.length} samples over ${Math.round(durationMs / 1000)}s at ${concurrency} concurrency.`);
    console.log(`  p95 latency: ${earlyP95}ms (early) -> ${lateP95}ms (late)  [${p95Drift >= 0 ? '+' : ''}${p95Drift}%]`);
    console.log(`  failures: ${earlyFail} (early) -> ${lateFail} (late)`);

    // Server-side vitals from the metric sampler.
    let memDrift = false;
    let poolBackedUp = false;
    if (sampler) {
        const rssMb = (b) => Math.round(b / 1024 / 1024);
        const samplesM = sampler.getSamples().filter(s => s.health);
        const first = samplesM.length ? samplesM[0].health.rss : 0;
        const last = samplesM.length ? samplesM[samplesM.length - 1].health.rss : 0;

        // Warm-up-aware leak check: compare the MIDPOINT to the END, skipping the
        // startup ramp (idle->serving) that inflates early memory. Sustained
        // growth in the back half is the real leak signal; warm-up plateaus.
        const mid = samplesM.length ? samplesM[Math.floor(samplesM.length / 2)].health.rss : 0;
        const backHalfGrowth = mid > 0 ? Math.round(((last - mid) / mid) * 100) : 0;
        // Only judge memory drift on runs long enough for warm-up to finish
        // (short runs are dominated by V8/GC warm-up and would false-positive).
        const MEM_VERDICT_MIN_MS = 120000; // 2 minutes
        memDrift = durationMs >= MEM_VERDICT_MIN_MS && backHalfGrowth > 15;

        const firstGrowth = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
        console.log(`  memory (RSS): ${rssMb(first)}MB -> ${rssMb(last)}MB  [${firstGrowth >= 0 ? '+' : ''}${firstGrowth}% total, ${backHalfGrowth >= 0 ? '+' : ''}${backHalfGrowth}% post-warmup], peak ${rssMb(sampler.peakRss())}MB`);

        const peakWaiting = sampler.peakPoolWaiting();
        poolBackedUp = peakWaiting > 0;
        console.log(`  DB pool waiting: peak ${peakWaiting}`);
    }

    // Trace breakdown across the whole soak (prints regardless of verdict).
    if (allResults && allResults.length) {
        printTraceStats(allResults, { title: 'Trace breakdown (whole soak):' });
    }

    // Drift verdict: rising latency (>25%), growing failures, sustained memory
    // growth after warm-up, or DB pool backing up = drift.
    const drift = p95Drift > 25 || lateFail > earlyFail || memDrift || poolBackedUp;
    if (drift) {
        console.log('  VERDICT: [!] drift detected — latency and/or failures worsened over time.');
        return 1;
    }
    console.log('  VERDICT: [ok] stable — no significant drift at constant load.');
    return 0;
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(v, w) { return String(v).padEnd(w); }

module.exports = { runSoak };