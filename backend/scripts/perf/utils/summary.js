'use strict';

/**
 * Shared report helpers for the load modes (ramp, ceiling, soak).
 *
 * These functions describe what happened during a run. They never judge it:
 * there is no pass/fail or stable/drift here, only numbers and where they
 * came from, so the reader decides what matters.
 */

/**
 * Read a percentile from an array that is already sorted ascending.
 * @param {Array<number>} sorted - Values sorted ascending
 * @param {number} p - Percentile to read, 0-100
 * @returns {number} The value at that percentile, or 0 for an empty array
 */
function percentile(sorted, p) {
    if (sorted.length === 0) {
        return 0;
    }
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

/**
 * Summarise one batch of replayed sessions.
 *
 * Every replayed request ends in exactly one of three states:
 *   ok     - the server answered with success
 *   failed - the server answered with success: false, or the emit threw
 *   noAck  - no answer within --ack-timeout; a backed-up DB pool looks like this
 * Latency is only known for ok requests, so avg/p50/p95/max describe answered
 * requests only.
 * @param {Array<Object>} results - Session results from replayUserTraces ({total, passed, failed, noAck, latencies})
 * @param {number} durationMs - Wall-clock duration of the batch in ms
 * @returns {{sessions: number, sent: number, ok: number, failed: number, noAck: number, noAckPct: number, avg: number, p50: number, p95: number, max: number, perSec: number}} Counts, latency of answered requests in ms, and answered requests per second
 */
function levelMetrics(results, durationMs) {
    let sent = 0;
    let ok = 0;
    let failed = 0;
    let noAck = 0;
    const lats = [];
    for (const s of (results || [])) {
        sent += s.total || 0;
        ok += s.passed || 0;
        failed += s.failed || 0;
        noAck += s.noAck || 0;
        for (const l of (s.latencies || [])) {
            lats.push(l.latency);
        }
    }
    lats.sort((a, b) => a - b);
    const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
    const durSec = (durationMs || 0) / 1000;
    return {
        sessions: (results || []).length,
        sent,
        ok,
        failed,
        noAck,
        noAckPct: sent > 0 ? Math.round((noAck / sent) * 1000) / 10 : 0,
        avg,
        p50: Math.round(percentile(lats, 50)),
        p95: Math.round(percentile(lats, 95)),
        max: lats.length ? Math.round(lats[lats.length - 1]) : 0,
        perSec: durSec > 0 ? Math.round((ok + failed) / durSec) : 0,
    };
}

// Column layout shared by the per-level / per-sample tables.
const LEVEL_COLUMNS = [
    ['sessions', 8], ['sent', 6], ['ok', 6], ['failed', 6], ['noAck', 6], ['noAck%', 6],
    ['p50ms', 6], ['p95ms', 6], ['maxms', 6], ['ans/s', 6],
];

/**
 * Print the header row of a per-level table.
 * @param {Array<Array>} lead - Leading columns as [name, width] pairs, e.g. [['level', 5]]
 * @param {Array<Array>} [extra=[]] - Trailing columns as [name, width] pairs
 * @returns {void}
 */
function printLevelHeader(lead, extra = []) {
    const cols = [...lead, ...LEVEL_COLUMNS, ...extra];
    console.log('  ' + cols.map(([name, w]) => pad(name, w)).join('  '));
}

/**
 * Print one row of a per-level table.
 * @param {Array<Array>} lead - Leading cells as [value, width] pairs; widths must match printLevelHeader
 * @param {Object} m - Metrics from levelMetrics
 * @param {Array<Array>} [extra=[]] - Trailing cells as [value, width] pairs
 * @returns {void}
 */
function printLevelRow(lead, m, extra = []) {
    const values = [m.sessions, m.sent, m.ok, m.failed, m.noAck, m.noAckPct, m.p50, m.p95, m.max, m.perSec];
    const cells = [...lead, ...values.map((v, i) => [v, LEVEL_COLUMNS[i][1]]), ...extra];
    console.log('  ' + cells.map(([v, w]) => pad(v, w)).join('  '));
}

/**
 * Print totals over a whole run.
 * @param {Array<Object>} results - Every session result of the run
 * @returns {void}
 */
function printRequestTotals(results) {
    const m = levelMetrics(results, 0);
    const pct = (n) => (m.sent > 0 ? ((n / m.sent) * 100).toFixed(1) : '0.0');
    console.log('  Requests (whole run)');
    console.log(`    sent:      ${m.sent}`);
    console.log(`    ok:        ${m.ok}  (${pct(m.ok)}%)`);
    console.log(`    failed:    ${m.failed}  (${pct(m.failed)}%)`);
    console.log(`    no reply:  ${m.noAck}  (${pct(m.noAck)}%)  — no answer within --ack-timeout`);
    console.log(`    latency of answered requests: p50 ${m.p50}ms, p95 ${m.p95}ms, max ${m.max}ms`);
}

/**
 * Print the server vitals block from a stopped MetricSampler, including how
 * many samples the monitor missed, so a gap is never silent.
 * @param {Object} sampler - Stopped MetricSampler
 * @returns {void}
 */
function printVitals(sampler) {
    if (!sampler) {
        return;
    }
    const mb = (b) => Math.round((b || 0) / 1024 / 1024);
    const cov = sampler.coverage();
    const covLine = (c) => `${c.tried - c.missed}/${c.tried}` + (c.missed > 0 ? ` (${c.missed} missed)` : '');

    console.log('');
    console.log(`  Server vitals (sampled every ${sampler.intervalMs}ms)`);
    console.log(`    monitor coverage:  health ${covLine(cov.health)}, db stats ${covLine(cov.stats)}`);
    if (cov.health.missed > 0 || cov.stats.missed > 0) {
        console.log('                       missed = the server did not answer in time; see "monitor.gaps" in the JSON');
    }

    const rss = sampler.rssTrend();
    const heap = sampler.heapTrend();
    console.log(`    memory RSS:        ${mb(rss.first)}MB -> ${mb(rss.mid)}MB -> ${mb(rss.last)}MB (start -> middle -> end), peak ${mb(sampler.peakRss())}MB`);
    console.log(`    memory heap:       ${mb(heap.first)}MB -> ${mb(heap.mid)}MB -> ${mb(heap.last)}MB (start -> middle -> end), peak ${mb(sampler.peakHeap())}MB`);

    const loop = sampler.eventLoopSummary();
    if (loop) {
        console.log(`    event loop delay:  max ${loop.maxMs}ms, worst p99 ${loop.worstP99Ms}ms  (how long the server was too busy to start new work)`);
    }

    const pool = sampler.poolSummary();
    if (pool) {
        console.log(`    DB pool:           max ${pool.max ?? '?'}, peak open ${pool.peakSize}, peak in use ${pool.peakUsing}, peak waiting ${pool.peakWaiting} (${pool.peakWaitingWhenFull} while the pool was full)`);
    }

    const files = sampler.openFilesSummary();
    if (files) {
        console.log(`    open files:        ${files.first} -> ${files.mid} -> ${files.last} (start -> middle -> end), peak ${files.peak}` +
            (files.limit != null ? ` of a limit of ${files.limit}` : ' (process limit unknown on this OS)'));
    }

    const sockets = sampler.peakSockets();
    if (sockets != null) {
        console.log(`    sockets:           peak ${sockets} connected`);
    }

    const pg = sampler.pgStatsSummary();
    if (pg) {
        console.log(`    Postgres:          deadlocks +${pg.deadlocksDelta}, rollbacks +${pg.rollbacksDelta}, peak lock-waits ${pg.peakLockWaits}` +
            (pg.minCacheHit != null ? `, min cache-hit ${pg.minCacheHit.toFixed(1)}%` : ''));
    }
}

/**
 * Print the fixed reading notes at the end of every load report: what the
 * numbers cannot tell, so they aren't over-read.
 * @returns {void}
 */
function printReadingNotes() {
    console.log('');
    console.log('  How to read this');
    console.log('    - Latency is measured only for answered requests; check "no reply" next to it.');
    console.log('    - Some events never reply by design (e.g. collabUnsubscribe). Compare "no reply" with a 1-session run.');
    console.log('    - The replay clients run inside the backend process, so its CPU and memory include the load generator.');
    console.log('    - Every session replays the same recorded user and data: worst case for writes to one document.');
}

/**
 * Right-pad a value to a fixed width for aligned table output.
 * @param {*} v - Value to pad (coerced to string)
 * @param {number} w - Target column width
 * @returns {string} The padded string
 */
function pad(v, w) {
    return String(v).padEnd(w);
}

module.exports = {
    percentile,
    levelMetrics,
    printLevelHeader,
    printLevelRow,
    printRequestTotals,
    printVitals,
    printReadingNotes,
    pad,
};
