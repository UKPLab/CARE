'use strict';

const { resolvePayload } = require('./utils/recordings');

/**
 * Inspect recordings: fetch each recording's traces and report a plain
 * distribution of every action type (count + %), so a regression "pass" can be
 * eyeballed for what it actually exercised. Also flags possible Gap-2
 * truncation (a recording cut short by a page navigation).
 * @param {Object} cfg - Run configuration; reads the recordings/files that resolvePayload consumes
 * @param {Object} ctx - Run context: { socket, emitWithAck, userId } from the CLI's connected session
 * @returns {Promise<number>} exit code (0; inspection is informational)
 */
async function runInspect(cfg, ctx) {
    const { recordingIds, sessions } = await resolvePayload(cfg, ctx);

    // File path: the traces are already in hand — analyze them directly,
    // no server round-trip.
    if (sessions.length) {
        for (const session of sessions) {
            analyzeRecording(session.recordingName || session.sessionKey, session.traces || []);
        }
        return 0;
    }

    // DB path: fetch each recording's traces from the server by id. Each fetch
    // is isolated so one unreadable recording (or a transient error) doesn't
    // abort the whole batch — the survey continues and reports what it could.
    for (const id of recordingIds) {
        let ack;
        try {
            ack = await ctx.emitWithAck('recordingGetTraces', { id });
        } catch (err) {
            console.log(`\n=== Recording ${id} ===`);
            console.log(`  could not fetch traces: ${err.message}`);
            continue;
        }
        if (!ack || !ack.success) {
            console.log(`\n=== Recording ${id} ===`);
            console.log(`  could not fetch traces: ${ack && ack.message}`);
            continue;
        }
        analyzeRecording(id, ack.data || []);
    }
    return 0;
}

/**
 * Print a trace-count and action-distribution summary for one recording.
 * @param {number|string} id - Recording id or display name for the header
 * @param {Array<Object>} traces - The recording's traces ({action, direction})
 * @returns {void}
 */
function analyzeRecording(id, traces) {
    const total = traces.length;
    const byAction = {};
    let incoming = 0, outgoing = 0;

    for (const t of traces) {
        byAction[t.action] = (byAction[t.action] || 0) + 1;
        if (t.direction === true || t.direction === 1) incoming++; else outgoing++;
    }

    console.log(`\n=== Recording ${id} ===`);
    console.log(`  total traces: ${total}  (incoming ${incoming}, outgoing ${outgoing})`);
    console.log(`  distinct actions: ${Object.keys(byAction).length}`);

    // Plain distribution of every action type, most frequent first. No
    // classification or verdict — the reader decides what matters.
    console.log('  distribution:');
    const entries = Object.entries(byAction).sort((a, b) => b[1] - a[1]);
    for (const [action, count] of entries) {
        const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
        console.log(`    ${action}: ${count}  (${pct}%)`);
    }

    // Gap-2 heads-up: a trailing disconnect can mean a page navigation cut the
    // recording short, so later actions may be missing. Not a classification —
    // a coverage warning worth keeping.
    const last = traces[traces.length - 1];
    if (last && (last.action === 'disconnect' || last.action === 'disconnecting')) {
        console.log('  NOTE: ends on a disconnect — if the story continued after a page navigation,');
        console.log('        later actions may be missing (Gap 2). Verify coverage.');
    }
}

module.exports = { runInspect };