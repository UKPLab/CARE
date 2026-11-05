'use strict';

const { percentile } = require('./summary');

/**
 * Aggregate replay results by action into per-action statistics, so "something
 * failed / was slow / got no reply" becomes "THIS action did". Every field is
 * derived from what replayUserTraces returns: latencies[] (answered ok),
 * errors[] (answered with a failure, or the emit threw) and noAckTraces[] (no
 * answer within the ack timeout).
 *
 * @param {Array<Object>} results - Session results ({latencies, errors, noAckTraces})
 * @returns {Array<Object>} Per-action stats, actions with failures or missing replies first, then slowest p95
 */
function traceStats(results) {
    const byAction = new Map();

    const ensure = (action) => {
        if (!byAction.has(action)) {
            byAction.set(action, {
                action, sent: 0, ok: 0, failed: 0, noAck: 0,
                lats: [], refreshEvents: 0, errorMsgs: new Map(),
            });
        }
        return byAction.get(action);
    };

    for (const s of (results || [])) {
        for (const l of (s.latencies || [])) {
            const a = ensure(l.action || 'unknown');
            a.sent++;
            a.ok++;
            if (typeof l.latency === 'number') {
                a.lats.push(l.latency);
            }
            a.refreshEvents += (l.dbChanges ? l.dbChanges.length : 0);
        }
        for (const e of (s.errors || [])) {
            const a = ensure(e.action || 'unknown');
            a.sent++;
            a.failed++;
            a.refreshEvents += (e.dbChanges ? e.dbChanges.length : 0);
            const msg = e.message || 'unknown error';
            a.errorMsgs.set(msg, (a.errorMsgs.get(msg) || 0) + 1);
        }
        for (const n of (s.noAckTraces || [])) {
            const a = ensure(n.action || 'unknown');
            a.sent++;
            a.noAck++;
        }
    }

    const out = [];
    for (const a of byAction.values()) {
        a.lats.sort((x, y) => x - y);
        const n = a.lats.length;
        const sum = a.lats.reduce((x, y) => x + y, 0);
        out.push({
            action: a.action,
            sent: a.sent,
            ok: a.ok,
            failed: a.failed,
            noAck: a.noAck,
            min: n ? a.lats[0] : 0,
            p50: percentile(a.lats, 50),
            avg: n ? Math.round(sum / n) : 0,
            p95: percentile(a.lats, 95),
            max: n ? a.lats[n - 1] : 0,
            totalMs: sum,
            refreshEvents: a.refreshEvents,
            errorMsgs: a.errorMsgs,
        });
    }
    out.sort((x, y) => ((y.failed + y.noAck) - (x.failed + x.noAck)) || (y.p95 - x.p95));
    return out;
}

/**
 * Print a per-action table, plus the failure messages per action.
 * @param {Array<Object>} results - Session results
 * @param {Object} [opts] - Display options
 * @param {string} [opts.title] - Heading above the table
 * @param {boolean} [opts.showErrors=true] - Also list failure messages per action
 * @param {number} [opts.topN] - Only print the first N actions
 * @returns {void}
 */
function printTraceStats(results, opts = {}) {
    const stats = traceStats(results);
    if (stats.length === 0) {
        console.log('  (no trace data)');
        return;
    }
    const rows = opts.topN ? stats.slice(0, opts.topN) : stats;

    console.log('');
    console.log('  ' + (opts.title || 'Per-action stats:'));
    console.log('  action                       sent   ok     fail   noAck  p50ms  p95ms  maxms  totalMs  refresh');
    for (const s of rows) {
        console.log(
            '  ' + pad(s.action, 27) + '  ' +
            pad(s.sent, 5) + '  ' + pad(s.ok, 5) + '  ' + pad(s.failed, 5) + '  ' + pad(s.noAck, 5) + '  ' +
            pad(s.p50, 5) + '  ' + pad(s.p95, 5) + '  ' + pad(s.max, 5) + '  ' +
            pad(s.totalMs, 7) + '  ' + pad(s.refreshEvents, 7)
        );
    }
    console.log('  (latency columns cover answered requests only; refresh = Refresh broadcasts received after the request, reads included — not a count of DB writes)');

    if (opts.showErrors !== false) {
        const withErrors = stats.filter(s => s.failed > 0);
        if (withErrors.length > 0) {
            console.log('');
            console.log('  failure messages by action:');
            for (const s of withErrors) {
                for (const [msg, cnt] of s.errorMsgs) {
                    console.log(`    ${s.action}: ${cnt}x — ${msg}`);
                }
            }
        }
    }
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

/**
 * Correlate memory growth with trace activity over time. Buckets requests
 * into the windows between consecutive memory readings and reports which
 * actions ran during the windows where RSS grew most.
 *
 * NOTE: this is correlation, not attribution — RSS is process-wide and
 * GC-scheduled, so per-request memory cannot be measured without heap
 * profiling that would distort the run. It is a lead, not proof.
 *
 * @param {Array<Object>} results - Session results (requests carry a ts field)
 * @param {Array<Object>} vitals - sampler.getSamples() ({t, health} entries)
 * @param {number} [topWindows=3] - How many growth windows to report
 * @returns {void}
 */
function printMemoryCorrelation(results, vitals, topWindows = 3) {
    const mem = (vitals || []).filter(v => v.health && typeof v.health.rss === 'number');
    if (mem.length < 3) {
        return;
    }

    const traces = [];
    for (const s of (results || [])) {
        for (const l of (s.latencies || [])) {
            if (l.ts) {
                traces.push({ ts: l.ts, action: l.action });
            }
        }
        for (const e of (s.errors || [])) {
            if (e.ts) {
                traces.push({ ts: e.ts, action: e.action });
            }
        }
        for (const n of (s.noAckTraces || [])) {
            if (n.ts) {
                traces.push({ ts: n.ts, action: n.action });
            }
        }
    }
    if (traces.length === 0) {
        console.log('  (memory correlation unavailable — requests have no timestamps)');
        return;
    }

    const windows = [];
    for (let i = 1; i < mem.length; i++) {
        windows.push({ from: mem[i - 1].t, to: mem[i].t, delta: mem[i].health.rss - mem[i - 1].health.rss, actions: new Map() });
    }
    for (const tr of traces) {
        const w = windows.find(win => tr.ts >= win.from && tr.ts < win.to);
        if (w) {
            w.actions.set(tr.action, (w.actions.get(tr.action) || 0) + 1);
        }
    }

    const growers = windows.filter(w => w.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, topWindows);
    console.log('');
    if (growers.length === 0) {
        console.log('  Memory correlation: RSS did not grow between any two readings.');
        return;
    }
    console.log('  Memory correlation (a lead, not proof — which actions ran while RSS grew):');
    const mb = (b) => (b / 1024 / 1024).toFixed(1);
    for (const w of growers) {
        const top = [...w.actions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([a, c]) => `${a} (${c}x)`).join(', ');
        console.log(`    +${mb(w.delta)}MB window: ${top || 'no requests in window'}`);
    }
}

module.exports = { traceStats, printTraceStats, printMemoryCorrelation };
