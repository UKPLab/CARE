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
 * Ceiling finder: climb concurrency by --step each level until one of the
 * stop conditions is met or --max-iterations levels have run, then report
 * every level and which conditions stopped the climb. The stop conditions
 * decide when to stop pushing; they are reported as facts, not as a verdict.
 *
 * Stop conditions, checked after every level:
 *   - more failed requests than --max-failures
 *   - failed + no-reply requests above --fail-threshold percent of those sent
 *   - p95 latency of answered requests above --latency-threshold ms
 *   - requests waiting for a DB connection while the pool was at its max size
 *     (waiting while the pool is still growing is only a new connection opening)
 *
 * @param {Object} cfg - Run configuration; reads step, maxIterations (cap on levels), latencyThreshold, maxFailures, failThreshold, ackTimeout, and the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<{code: number, maxConcurrency: number}>} Exit code (0 run completed, 1 tool error or lost server connection) and the highest concurrency at which no stop condition was met
 */
async function runCeiling(cfg, ctx) {
    const capture = makeOutputCapture();
    capture.start();
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);
    const step = cfg.step > 0 ? cfg.step : 5;
    const hardCap = cfg.maxIterations > 0 ? cfg.maxIterations : Infinity;

    console.log('  ceiling input: ' + (sessions.length ? `${sessions.length} file session(s)` : recordingIds.join(', ')));
    console.log(`Climbing by ${step} sessions per level (ack timeout ${cfg.ackTimeout}ms). Stops on: failed > ${cfg.maxFailures || 0}, ` +
        `failed + no reply > ${cfg.failThreshold}%, p95 > ${cfg.latencyThreshold}ms, or requests waiting while the DB pool is full.`);
    printLevelHeader([['level', 5]], [['poolWait', 8], ['waitWhenFull', 12]]);

    const sampler = new MetricSampler(ctx.emitWithAck, 1000);
    await sampler.start();

    let concurrency = step;
    let level = 0;
    let lastClear = 0;
    let stopReasons = [];
    let lostConnection = null;
    const allLevels = [];

    try {
        while (level < hardCap) {
            level++;
            const progressId = randomUUID();
            const onProgress = (data) => {
                if (data.id !== progressId) {
                    return;
                }
                const pct = data.total ? Math.floor((data.current / data.total) * 100) : 0;
                process.stdout.write(`\r  level ${level} (${concurrency} sessions): ${pct}%   `);
            };
            ctx.socket.on('progressUpdate', onProgress);

            const levelStart = Date.now();
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
                // The server connection dropped mid-level: stop, but still report what finished.
                lostConnection = err.message;
            } finally {
                ctx.socket.off('progressUpdate', onProgress);
            }

            process.stdout.write('\r' + ' '.repeat(50) + '\r');

            if (lostConnection) {
                stopReasons = [`lost the server connection during level ${level} (${concurrency} sessions): ${lostConnection}`];
                break;
            }

            if (!ack || !ack.success) {
                console.error('\nCEILING ERROR — replayRun failed: ' + (ack && ack.message));
                capture.stop();
                return { code: 1, maxConcurrency: lastClear };
            }

            const m = levelMetrics(ack.data.results, ack.data.duration);
            const poolWait = sampler.peakPoolWaiting(levelStart);
            const poolWaitFull = sampler.peakPoolWaitingWhenFull(levelStart);
            allLevels.push({ level, concurrency, poolWait, poolWaitFull, ...m, results: ack.data.results });
            printLevelRow([[level, 5]], m, [[poolWait, 8], [poolWaitFull, 12]]);

            stopReasons = stopConditionsMet(m, poolWaitFull, cfg);
            if (stopReasons.length > 0) {
                break;
            }
            lastClear = concurrency;
            concurrency += step;
        }
    } finally {
        await sampler.stop();
    }

    const last = allLevels[allLevels.length - 1];
    const summary = {
        levels: allLevels.length,
        lastConcurrency: last ? last.concurrency : 0,
        highestWithoutStop: lastClear,
        stoppedBy: stopReasons,
    };

    console.log('');
    console.log('=== Ceiling report ===');
    if (stopReasons.length > 0) {
        const where = lostConnection ? `during level ${level}` : `at level ${last.level} (${last.concurrency} sessions)`;
        console.log(`  Stopped ${where} because:`);
        for (const r of stopReasons) {
            console.log(`    - ${r}`);
        }
        console.log(`  Highest level where none of the stop conditions were met: ${lastClear} sessions.`);
    } else {
        console.log(`  Ran all ${allLevels.length} levels up to ${summary.lastConcurrency} sessions; no stop condition was met. Raise --max-iterations to push further.`);
    }
    console.log('');
    printRequestTotals(allLevels.flatMap(l => l.results || []));
    printVitals(sampler);
    if (last) {
        printTraceStats(last.results, { title: `Per-action stats at the last level (${last.concurrency} sessions):` });
    }
    printReadingNotes();

    const saved = saveResults('ceiling', cfg, {
        results: allLevels.flatMap(l => l.results || []),
        metrics: allLevels.map(({ results, ...rest }) => rest),
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
    return { code: lostConnection ? 1 : 0, maxConcurrency: lastClear };
}

/**
 * List which stop conditions one level met.
 * @param {Object} m - The level's metrics from levelMetrics
 * @param {number} poolWaitFull - Peak requests waiting for a DB connection while the pool was full, during the level
 * @param {Object} cfg - Run configuration; reads maxFailures, failThreshold and latencyThreshold
 * @returns {Array<string>} One description per condition met; empty when none
 */
function stopConditionsMet(m, poolWaitFull, cfg) {
    const reasons = [];
    const allowedFailures = cfg.maxFailures || 0;
    if (m.failed > allowedFailures) {
        reasons.push(`${m.failed} failed request(s), more than --max-failures ${allowedFailures}`);
    }
    const unansweredPct = m.sent > 0 ? ((m.failed + m.noAck) / m.sent) * 100 : 0;
    if (unansweredPct > cfg.failThreshold) {
        reasons.push(`${unansweredPct.toFixed(1)}% of requests failed or got no reply, more than --fail-threshold ${cfg.failThreshold}%`);
    }
    if (m.p95 > cfg.latencyThreshold) {
        reasons.push(`p95 latency ${m.p95}ms, more than --latency-threshold ${cfg.latencyThreshold}ms`);
    }
    if (poolWaitFull > 0) {
        reasons.push(`${poolWaitFull} request(s) waited for a DB connection while every pool connection was in use`);
    }
    return reasons;
}

module.exports = { runCeiling };
