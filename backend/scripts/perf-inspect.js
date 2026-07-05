'use strict';

const { resolveRecordings } = require('./perf-recordings');

// Plumbing/infrastructure events — never a user-story action. Blocklist for the
// obvious ones; the *Refresh / *Subscribe suffixes catch the families.
const NOISE_EVENTS = new Set([
    'subscribeAppData', 'unsubscribeAppData', 'stats',
    'userMonitorSubscribe', 'userMonitorUnsubscribe',
    'serviceCommand', 'userGetByRole', 'userByRole',
]);

function isNoise(action) {
    if (typeof action !== 'string') return true;
    if (NOISE_EVENTS.has(action)) return true;
    if (action.endsWith('Refresh')) return true;                 // server pushes
    if (action.endsWith('Subscribe') || action.endsWith('Unsubscribe')) return true;
    return false;
}

// A real user-story action mutates data: create / update / delete / add /
// remove / submit / save / vote / reply. Positively identifies story content
// rather than trying to enumerate the long tail of plumbing. This is a
// heuristic — refine the pattern once real story recordings show the actual
// event names CARE emits.
function isMeaningful(action) {
    if (typeof action !== 'string') return false;
    if (isNoise(action)) return false;
    return /(Create|Update|Delete|Add|Remove|Submit|Save|Vote|Reply)/i.test(action);
}

/**
 * Inspect recordings: fetch each recording's traces and report what's actually
 * in it — meaningful user actions vs plumbing noise vs other — so a regression
 * "pass" can be trusted to have exercised a real story. Also flags possible
 * Gap-2 truncation (a recording cut short by a page navigation).
 * @param {Object} cfg
 * @param {Object} ctx - { emitWithAck }
 * @returns {Promise<number>} exit code (0; inspection is informational)
 */
async function runInspect(cfg, ctx) {
    const ids = await resolveRecordings(cfg, ctx);

    for (const id of ids) {
        const ack = await ctx.emitWithAck('recordingGetTraces', { id });
        if (!ack || !ack.success) {
            console.log(`\n=== Recording ${id} ===`);
            console.log(`  could not fetch traces: ${ack && ack.message}`);
            continue;
        }
        analyzeRecording(id, ack.data || []);
    }
    return 0;
}

function analyzeRecording(id, traces) {
    const total = traces.length;
    const byAction = {};
    let meaningfulCount = 0, noiseCount = 0, otherCount = 0, incoming = 0, outgoing = 0;

    for (const t of traces) {
        byAction[t.action] = (byAction[t.action] || 0) + 1;
        if (isMeaningful(t.action)) meaningfulCount++;
        else if (isNoise(t.action)) noiseCount++;
        else otherCount++;
        if (t.direction === true || t.direction === 1) incoming++; else outgoing++;
    }

    console.log(`\n=== Recording ${id} ===`);
    console.log(`  total traces: ${total}  (incoming ${incoming}, outgoing ${outgoing})`);
    console.log(`  meaningful: ${meaningfulCount}   other: ${otherCount}   noise: ${noiseCount}`);

    const entries = Object.entries(byAction).sort((a, b) => b[1] - a[1]);
    const meaningful = entries.filter(([a]) => isMeaningful(a));
    const other = entries.filter(([a]) => !isMeaningful(a) && !isNoise(a));
    const noise = entries.filter(([a]) => isNoise(a));

    if (meaningful.length) {
        console.log('  meaningful actions (data mutations):');
        for (const [a, c] of meaningful) console.log(`    ${a}: ${c}`);
    }
    if (other.length) {
        console.log('  other (not clearly a mutation — eyeball these):');
        for (const [a, c] of other) console.log(`    ${a}: ${c}`);
    }
    if (noise.length) {
        console.log('  noise (plumbing):');
        for (const [a, c] of noise) console.log(`    ${a}: ${c}`);
    }

    // Coverage verdict — keyed on meaningful (data-mutating) actions only.
    if (meaningfulCount === 0) {
        console.log('  VERDICT: [!] no data-mutating actions — this recording does NOT test a real story.');
    } else if (meaningfulCount < 3) {
        console.log(`  VERDICT: [!] only ${meaningfulCount} mutating action(s) — thin; verify it captures the intended story.`);
    } else {
        console.log(`  VERDICT: [ok] ${meaningfulCount} data-mutating actions captured.`);
    }

    // Gap-2 detection: a trailing disconnect can mean a navigation cut it short.
    const last = traces[traces.length - 1];
    if (last && (last.action === 'disconnect' || last.action === 'disconnecting')) {
        console.log('  NOTE: ends on a disconnect — if the story continued after a page navigation,');
        console.log('        later actions may be missing (Gap 2). Verify coverage.');
    }
}

module.exports = { runInspect };