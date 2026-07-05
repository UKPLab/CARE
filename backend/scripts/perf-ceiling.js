'use strict';

const { resolveRecordings } = require('./perf-recordings');
const { randomUUID } = require('crypto');

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
    const ids = await resolveRecordings(cfg, ctx);
    const step = cfg.step > 0 ? cfg.step : 5;
    const hardCap = cfg.maxIterations > 0 ? cfg.maxIterations : Infinity;

    console.log('  ceiling recordings: ' + ids.join(', '));
    console.log(`Climbing concurrency by ${step} each level until failure or p95 > ${cfg.latencyThreshold}ms ...`);
    console.log('  level  concurrency  passed  failed  avgMs  p95Ms  thru/s  status');

    let concurrency = step;
    let level = 0;
    let lastGood = 0;

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
            recordingIds: ids,
            timingMode: 'fast',
            ackTimeout: cfg.ackTimeout,
            singleLevel: concurrency,
            progressId,
        }, 0);

        ctx.socket.off('progressUpdate', onProgress);
        process.stdout.write('\r' + ' '.repeat(50) + '\r');  // clear the progress line

        if (!ack || !ack.success) {
            console.error('\nCEILING ERROR — replayRun failed: ' + (ack && ack.message));
            return 1;
        }

        const m = metrics(ack.data);
        const tripped = m.failed > 0 || m.p95 > cfg.latencyThreshold;
        const status = tripped ? 'STOP' : 'ok';
        console.log(`  ${pad(level, 5)}  ${pad(concurrency, 11)}  ${pad(m.passed, 6)}  ${pad(m.failed, 6)}  ${pad(m.avg, 5)}  ${pad(m.p95, 5)}  ${pad(m.thru, 6)}  ${status}`);

        if (tripped) {
            const reason = m.failed > 0 ? `${m.failed} trace failure(s)` : `p95 latency ${m.p95}ms > ${cfg.latencyThreshold}ms`;
            console.log(`\nCEILING: server sustained ${lastGood} concurrent sessions; degraded at ${concurrency} (${reason}).`);
            return 0;
        }

        lastGood = concurrency;
        if (level >= hardCap) {
            console.log(`\nCEILING: hit safety cap (${hardCap} levels) at ${concurrency} sessions, still healthy — raise --max-iterations or lower --latency-threshold to push further.`);
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