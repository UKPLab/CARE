'use strict';

/**
 * Aggregate replay results by trace action into per-type statistics.
 * Turns "something failed / was slow" into "THIS action failed / was slow /
 * hit the DB hardest", giving a concrete lead for diagnosis. Every field is
 * derived from data replayUserTraces already returns (latencies[] and errors[],
 * each carrying action + dbChanges).
 *
 * @param {Array} results - session result objects ({ latencies, errors })
 * @returns {Array} per-action stats, sorted slowest-p95 first
 */
function traceStats(results) {
    const byAction = new Map();

    const ensure = (action) => {
        if (!byAction.has(action)) {
            byAction.set(action, {
                action, count: 0, passed: 0, failed: 0,
                lats: [], dbWrites: 0, errorMsgs: new Map(),
            });
        }
        return byAction.get(action);
    };

    for (const s of (results || [])) {
        for (const l of (s.latencies || [])) {
            const a = ensure(l.action || 'unknown');
            a.count++; a.passed++;
            if (typeof l.latency === 'number') a.lats.push(l.latency);
            a.dbWrites += (l.dbChanges ? l.dbChanges.length : 0);
        }
        for (const e of (s.errors || [])) {
            const a = ensure(e.action || 'unknown');
            a.count++; a.failed++;
            a.dbWrites += (e.dbChanges ? e.dbChanges.length : 0);
            const msg = e.message || 'unknown error';
            a.errorMsgs.set(msg, (a.errorMsgs.get(msg) || 0) + 1);
        }
    }

    const pct = (n, arr) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(n * arr.length))] : 0;

    const out = [];
    for (const a of byAction.values()) {
        a.lats.sort((x, y) => x - y);
        const n = a.lats.length;
        const sum = a.lats.reduce((x, y) => x + y, 0);
        out.push({
            action: a.action,
            count: a.count,
            passed: a.passed,
            failed: a.failed,
            successRate: a.count ? Math.round((a.passed / a.count) * 100) : 0,
            min: n ? a.lats[0] : 0,
            p50: n ? pct(0.50, a.lats) : 0,
            avg: n ? Math.round(sum / n) : 0,
            p95: n ? pct(0.95, a.lats) : 0,
            max: n ? a.lats[n - 1] : 0,
            totalMs: sum,
            dbWrites: a.dbWrites,
            errorMsgs: a.errorMsgs,
        });
    }
    out.sort((x, y) => y.p95 - x.p95);   // slowest first = lead at the top
    return out;
}

/**
 * Print a per-trace-type stats table. Shared across all modes.
 * @param {Array} results - session results
 * @param {Object} [opts] - { title, showErrors=true, topN }
 */
function printTraceStats(results, opts = {}) {
    const stats = traceStats(results);
    if (stats.length === 0) { console.log('  (no trace data)'); return; }
    const rows = opts.topN ? stats.slice(0, opts.topN) : stats;

    console.log('');
    console.log('  ' + (opts.title || 'Per-trace-type stats (slowest first):'));
    console.log('  action                       count  fail  ok%   minMs  p50  avgMs  p95Ms  maxMs  totalMs  dbW');
    for (const s of rows) {
        console.log(
            '  ' + pad(s.action, 27) + '  ' +
            pad(s.count, 5) + '  ' + pad(s.failed, 4) + '  ' + pad(s.successRate, 4) + '  ' +
            pad(s.min, 5) + '  ' + pad(s.p50, 3) + '  ' + pad(s.avg, 5) + '  ' +
            pad(s.p95, 5) + '  ' + pad(s.max, 5) + '  ' + pad(s.totalMs, 7) + '  ' + pad(s.dbWrites, 3)
        );
    }

    if (opts.showErrors !== false) {
        const withErrors = stats.filter(s => s.failed > 0);
        if (withErrors.length > 0) {
            console.log('');
            console.log('  failures by action:');
            for (const s of withErrors) {
                for (const [msg, cnt] of s.errorMsgs) {
                    console.log(`    ${s.action}: ${cnt}x — ${msg}`);
                }
            }
        }
    }
}

function pad(v, w) { return String(v).padEnd(w); }

/**
 * Print a one-line "likely culprit" callout based on why a run stopped/failed.
 * @param {Array} results - session results
 * @param {Object} why - { failed, poolSaturated, overallP95 } describing the stop
 */
function printCulprit(results, why = {}) {
    const stats = traceStats(results);
    if (!stats.length) return;
    if (why.failed) {
        const worst = stats.filter(s => s.failed > 0).sort((a, b) => b.failed - a.failed)[0];
        if (worst) console.log(`\n  >> Likely culprit: ${worst.action} — ${worst.failed} failure(s). Start here.`);
    } else if (why.poolSaturated) {
        const worst = [...stats].sort((a, b) => b.dbWrites - a.dbWrites)[0];
        if (worst) console.log(`\n  >> Likely culprit: ${worst.action} — most DB writes (${worst.dbWrites}), likely saturating the pool. Start here.`);
    } else {
        const worst = [...stats].sort((a, b) => b.p95 - a.p95)[0];
        if (worst) {
            const overall = why.overallP95 != null ? ` Overall p95 was ${why.overallP95}ms — this action is dragging it up.` : '';
            console.log(`\n  >> Slowest action: ${worst.action} (its OWN p95: ${worst.p95}ms).${overall} Start here.`);
        }
    }
}

module.exports = { traceStats, printTraceStats, printCulprit };