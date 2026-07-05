#!/usr/bin/env node
'use strict';

/**
 * CARE perf-test harness (ramp mode — login + connect milestone).
 *
 * Replays recorded sessions as concurrent load against a running CARE backend
 * and reports degradation. Driven as a socket.io client so it exercises the
 * real socket/auth path. This stage: CLI parsing, real admin login, and an
 * authenticated socket connection. The ramp loop + metric sampling come next.
 */

const { io: SocketIOClient } = require('socket.io-client');
const { loginAsAdmin, verifyAdmin } = require('./perf-auth');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) {
                args[key] = true;
            } else {
                args[key] = next;
                i++;
            }
        }
    }
    return args;
}

function parseRecordings(val) {
    if (!val || val === true) return [];
    return String(val).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0);
}

function buildConfig(args) {
    return {
        mode: args.mode || 'ramp',
        recordings: parseRecordings(args.recordings),
        files: args.files && args.files !== true ? String(args.files).split(',').map(s => s.trim()).filter(Boolean) : [],
        maxIterations: parseInt(args['max-iterations'], 10) || 10,
        timingMode: args['timing-mode'] || 'fast',
        ackTimeout: parseInt(args['ack-timeout'], 10) || 2000,
        latencyThreshold: parseInt(args['latency-threshold'], 10) || 1000,
        failThreshold: parseFloat(args['fail-threshold']) || 5,
        server: args.server || 'http://localhost:3001',
        continueOnFailure: Boolean(args['continue-on-failure']),
        user: args.user || process.env.PERF_ADMIN_USER || 'admin',
        password: args.password || process.env.ADMIN_PWD || null,
        step: parseInt(args.step, 10) || 5,
    };
}

function validateConfig(cfg) {
    const errors = [];
    if (!['ramp', 'soak', 'regression', 'inspect', 'ceiling'].includes(cfg.mode)) errors.push(`--mode must be "ramp", "soak", "regression", "inspect", or "ceiling" (got "${cfg.mode}")`);
    if (cfg.recordings.length === 0 && cfg.files.length === 0) errors.push('need --recordings <ids> and/or --files <json,...>');
    if (cfg.mode === 'ramp' && (!Number.isInteger(cfg.maxIterations) || cfg.maxIterations < 1)) errors.push('--max-iterations must be a positive integer');
    if (cfg.timingMode !== 'fast' && cfg.timingMode !== 'realtime') errors.push('--timing-mode must be "fast" or "realtime"');
    if (!cfg.password) errors.push('admin password required: pass --password or set PERF_ADMIN_PASSWORD');
    return errors;
}

function connectSocket(serverUrl, cookie) {
    return new Promise((resolve, reject) => {
        const socket = SocketIOClient(serverUrl, {
            extraHeaders: { cookie },
            reconnection: false,
            timeout: 10000,
        });
        socket.on('ready', () => resolve(socket));
        socket.on('connect_error', (err) => reject(new Error('Socket connection failed: ' + err.message)));
        setTimeout(() => reject(new Error('Socket connection timed out (no "ready" within 10s)')), 10000);
    });
}

function emitWithAck(socket, event, payload, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = timeoutMs > 0
            ? setTimeout(() => reject(new Error('No ack for "' + event + '" within ' + timeoutMs + 'ms')), timeoutMs)
            : null;
        socket.emit(event, payload || {}, (res) => {
            if (timer) clearTimeout(timer);
            resolve(res);
        });
    });
}

/**
 * Confirm the connected socket actually has admin rights by calling an
 * admin-guarded handler. The tool needs admin to drive replayRun, so fail
 * fast here with a clear message rather than discovering it mid-run.
 */
async function verifyAdminAccess(socket) {
    const res = await emitWithAck(socket, 'recordingGetOnlineSessions', {});
    // createSocket acks are { success: bool, data?, message? }.
    if (res && res.success) return;
    const msg = (res && res.message) || 'unknown error';
    throw new Error('Configured account is not admin (recordingGetOnlineSessions rejected: ' + msg + '). Use an admin account.');
}

async function run(cfg) {
    console.log('\nLogging in as "' + cfg.user + '" at ' + cfg.server + ' ...');
    const cookie = await loginAsAdmin(cfg.server, cfg.user, cfg.password);
    const user = await verifyAdmin(cfg.server, cookie);
    console.log('  logged in as: ' + (user.userName || user.id) + ' (' + user.email + ')');
    console.log('Connecting socket ...');
    const socket = await connectSocket(cfg.server, cookie);
    console.log('  socket connected: ' + socket.id);

    console.log('Verifying admin access ...');
    await verifyAdminAccess(socket);
    console.log('  admin access confirmed.');

    // Bind emit to this socket so the recordings layer + modes can use it.
    const emit = (event, payload, timeoutMs) => emitWithAck(socket, event, payload, timeoutMs);
    const ctx = { socket, emitWithAck: emit, userId: user.id };

    if (cfg.mode === 'regression') {
        const { runRegression } = require('./perf-regression');
        const code = await runRegression(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'inspect') {
        const { runInspect } = require('./perf-inspect');
        const code = await runInspect(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'ramp') {
        const { runRamp } = require('./perf-ramp');
        const code = await runRamp(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'ceiling') {
        const { runCeiling } = require('./perf-ceiling');
        const code = await runCeiling(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }

    // ramp / soak: resolve recordings now; the driving loops come next.
    const { resolveRecordings } = require('./perf-recordings');
    const ids = await resolveRecordings(cfg, ctx);
    console.log('  resolved recording IDs: ' + ids.join(', '));

    console.log('\n[milestone] Resolved recordings. ' + cfg.mode + ' loop + metric sampling come next.');
    socket.disconnect();
    console.log('  socket disconnected. Done.');
}

function main() {
    const cfg = buildConfig(parseArgs(process.argv.slice(2)));
    const errors = validateConfig(cfg);
    if (errors.length > 0) {
        console.error('Invalid configuration:');
        for (const e of errors) console.error('  - ' + e);
        console.error('\nExample:\n  PERF_ADMIN_PASSWORD=... npm run perf -- --mode ramp --recordings 12,15 --max-iterations 30');
        process.exit(1);
    }

    console.log('CARE perf-test — configuration');
    console.log('  mode:          ' + cfg.mode);
    console.log('  recordings:    ' + cfg.recordings.join(', '));
    console.log('  maxIterations: ' + cfg.maxIterations);
    console.log('  server:        ' + cfg.server);
    console.log('  user:          ' + cfg.user);

    run(cfg).then(() => process.exit(0)).catch(err => {
        console.error('\nperf-test error: ' + err.message);
        process.exit(1);
    });
}

main();