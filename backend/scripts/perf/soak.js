'use strict';

const { randomUUID } = require('crypto');
const { resolvePayload } = require('./utils/recordings');
const { MetricSampler } = require('./utils/metrics');
const { printTraceStats, printMemoryCorrelation } = require('./utils/trace-stats');
const { saveResults, makeOutputCapture, saveReadableReport } = require('./utils/report');
const {
    levelMetrics, printLevelHeader, printLevelRow, printRequestTotals, printVitals, printReadingNotes,
} = require('./utils/summary');

/**
 * Soak mode: hold a fixed number of concurrent sessions for a duration, one
 * batch after another, and report how requests and server vitals changed
 * over time at constant load. Reports only; it does not judge the result.
 * Reuses replayRun's singleLevel mode to run one fixed-concurrency batch per sample.
 * @param {Object} cfg - Run configuration; reads concurrency (sessions held constant), duration (total soak time in ms), sampleInterval (pause between batches, 0 for back-to-back), ackTimeout, and the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<number>} Exit code: 0 when the run completed, 1 when the tool could not run it or the server connection dropped
 */
async function runSoak(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    const durationMs = cfg.duration;
    const concurrency = cfg.concurrency;

    console.log('  soak input: ' + (sessions.length ? `${sessions.length} file session(s)` : recordingIds.join(', ')));
    console.log(`Holding ${concurrency} concurrent sessions for ${Math.round(durationMs / 1000)}s, one batch after another (ack timeout ${cfg.ackTimeout}ms) ...`);
    printLevelHeader([['batch', 5], ['elapsed', 7]]);

    const start = Date.now();
    const allResults = [];
    const samples = [];
    let batch = 0;
    // Set when the server connection drops mid-run; the report still prints.
    let lostConnection = null;
    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    await sampler.start();

    try {
        while (Date.now() - start < durationMs) {
            batch++;
            const progressId = randomUUID();
            const onProgress = (data) => {
                if (data.id !== progressId) {
                    return;
                }
                const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
                process.stdout.write(`\r  batch ${batch}: ${pct}%   `);
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
                    notifyOnStop: false,   // no browser here; the outcome comes back in the ack
                }, 0);
            } catch (err) {
                lostConnection = err.message;
            } finally {
                ctx.socket.off('progressUpdate', onProgress);
            }

            process.stdout.write('\r' + ' '.repeat(40) + '\r');

            if (lostConnection) {
                console.error(`\nSOAK STOPPED in batch ${batch} — ${lostConnection}`);
                break;
            }

            if (!ack || !ack.success) {
                console.error('SOAK ERROR — replayRun failed: ' + (ack && ack.message));
                capture.stop();
                return 1;
            }

            const m = levelMetrics(ack.data.results, ack.data.duration);
            const elapsedSec = Math.round((Date.now() - start) / 1000);
            samples.push({ batch, elapsedSec, ...m });
            printLevelRow([[batch, 5], [elapsedSec + 's', 7]], m);
            if (ack.data.results) {
                allResults.push(...ack.data.results);
            }

            if (cfg.sampleInterval > 0) {
                const remaining = durationMs - (Date.now() - start);
                if (remaining > 0) {
                    await sleep(Math.min(cfg.sampleInterval, remaining));
                }
            }
        }
    } finally {
        await sampler.stop();
    }

    const summary = printSoakReport(samples, cfg, sampler, allResults, lostConnection);
    const saved = saveResults('soak', cfg, {
        results: allResults,
        metrics: samples,
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
    return lostConnection ? 1 : 0;
}

/**
 * Print the soak report: load, request totals, how the first third of the
 * batches compares with the last third, server vitals, per-action stats and
 * the memory correlation.
 * @param {Array<Object>} samples - Per-batch metrics in run order (levelMetrics plus batch and elapsedSec)
 * @param {Object} cfg - Run configuration; reads concurrency and duration
 * @param {Object} sampler - Stopped MetricSampler
 * @param {Array<Object>} allResults - Every session result across all batches
 * @param {string|null} lostConnection - Why the run ended early, or null when it ran its full duration
 * @returns {Object} The early/late comparison and how the run ended, also saved in the JSON
 */
function printSoakReport(samples, cfg, sampler, allResults, lostConnection) {
    console.log('');
    console.log('=== Soak report ===');
    if (lostConnection) {
        console.log(`  Ended early: ${lostConnection}. Numbers below cover the batches that finished.`);
    }
    console.log(`  Load: ${cfg.concurrency} concurrent sessions, ${samples.length} batches over ${Math.round(cfg.duration / 1000)}s`);
    console.log('');
    printRequestTotals(allResults);

    let comparison = null;
    console.log('');
    if (samples.length < 3) {
        console.log(`  Over time: only ${samples.length} batch(es) — run longer to compare start and end.`);
    } else {
        const third = Math.floor(samples.length / 3);
        const early = samples.slice(0, third);
        const late = samples.slice(-third);
        const mean = (arr, key) => Math.round(arr.reduce((s, x) => s + x[key], 0) / arr.length);
        comparison = {};
        console.log(`  Over time (mean per batch: first ${third} batches -> last ${third} batches)`);
        for (const [key, label] of [['p95', 'p95 latency ms'], ['failed', 'failed'], ['noAck', 'no reply'], ['perSec', 'answered/s']]) {
            comparison[key] = { early: mean(early, key), late: mean(late, key) };
            console.log(`    ${label.padEnd(15)} ${comparison[key].early} -> ${comparison[key].late}`);
        }
    }

    printVitals(sampler);
    printTraceStats(allResults, { title: 'Per-action stats (whole soak):' });
    printMemoryCorrelation(allResults, sampler.getSamples());
    printReadingNotes();
    return { comparison, endedEarly: lostConnection };
}

/**
 * Pause execution for a fixed duration.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Resolves once the delay has elapsed
 */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

module.exports = { runSoak };
