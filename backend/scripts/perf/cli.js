#!/usr/bin/env node
'use strict';

/**
 * CARE perf harness (ramp mode — login + connect milestone).
 *
 * Replays recorded sessions as concurrent load against a running CARE backend
 * and reports degradation. Driven as a socket.io client so it exercises the
 * real socket/auth path. This stage: CLI parsing, real admin login, and an
 * authenticated socket connection. The ramp loop + metric sampling come next.
 */

const { io: SocketIOClient } = require('socket.io-client');
const { login, verifyAuthenticatedSession } = require('./utils/auth');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const readline = require('readline');

/**
 * Prompt for the admin password on the terminal without echoing it.
 * Used when no --password flag and no env var is set (e.g. a deployed/test
 * box where the perf env vars aren't available). Never logged or stored.
 * @returns {Promise<string>} the entered password
 */
function promptPassword() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const stdout = process.stdout;
        // Mask input: intercept the output stream so typed chars aren't shown.
        const onData = (char) => {
            char = String(char);
            if (char === '\n' || char === '\r' || char === '\u0004') {
                stdout.write('\n');
            } else {
                // Overwrite the just-echoed char with nothing.
                stdout.clearLine(0);
                stdout.cursorTo(0);
                stdout.write('Admin password: ');
            }
        };
        process.stdin.on('data', onData);
        rl.question('Admin password: ', (answer) => {
            process.stdin.removeListener('data', onData);
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Parse `--flag value` and bare `--flag` CLI arguments into an object.
 * @param {Array<string>} argv - Raw argument list (process.argv minus node and script)
 * @returns {Object} Flag names (without `--`) mapped to their value, or `true` when the flag takes none
 */
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

/**
 * Parse a duration string like "30m", "90s", "1h" into milliseconds.
 * @param {string} val - Duration string such as "30s", "5m", or a raw millisecond count
 * @returns {number|null} Duration in milliseconds, or null when the value is absent or unparseable
 */
function parseDuration(val) {
    if (!val || val === true) return null;
    const m = String(val).trim().match(/^(\d+)\s*(ms|s|m|h)?$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 's').toLowerCase();
    const mult = { ms: 1, s: 1000, m: 60000, h: 3600000 }[unit];
    return n * mult;
}

/**
 * Parse a comma-separated list of recording ids.
 * @param {string|boolean} val - Raw `--recordings` value
 * @returns {Array<number>} Positive integer ids; empty if the flag was absent or held no valid ids
 */
function parseRecordings(val) {
    if (!val || val === true) return [];
    return String(val).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0);
}

/**
 * Build the run configuration from parsed CLI arguments, applying defaults
 * and falling back to environment variables where flags are absent.
 * Parse a flag that may be absent, set without a value, or given an explicit boolean.
 * @param {*} value - Raw argument value from parseArgs
 * @returns {boolean|null} true/false when specified, null when the flag was not passed
 */
function parseOptionalBoolean(value) {
    if (value === undefined) {
        return null;
    }
    if (value === 'false' || value === '0') {
        return false;
    }
    return Boolean(value);
}

/**
 * @param {Object} args - Parsed arguments from parseArgs
 * @returns {Object} The run configuration consumed by validateConfig and the mode handlers
 */
function buildConfig(args) {
    return {
        mode: args.mode || 'ramp',
        recordings: parseRecordings(args.recordings),
        files: args.files && args.files !== true ? String(args.files).split(',').map(s => s.trim()).filter(Boolean) : [],
        dir: args.dir && args.dir !== true ? String(args.dir) : null,
        maxIterations: parseInt(args['max-iterations'], 10) || 10,
        timingMode: args['timing-mode'] || 'fast',
        ackTimeout: parseInt(args['ack-timeout'], 10) || 2000,
        latencyThreshold: args['latency-threshold'] !== undefined ? Number(args['latency-threshold']) : 1000,
        failThreshold: args['fail-threshold'] !== undefined ? Number(args['fail-threshold']) : 5,
        server: args.server || 'http://localhost:3001',
        continueOnFailure: parseOptionalBoolean(args['continue-on-failure']),
        user: args.user || process.env.PERF_ADMIN_USER || 'admin',
        password: args.password || process.env.PERF_ADMIN_PASSWORD || process.env.ADMIN_PWD || null,
        step: parseInt(args.step, 10) || 5,
        maxFailures: parseInt(args['max-failures'], 10) || 0,
        concurrency: parseInt(args.concurrency, 10) || 10,
        duration: parseDuration(args.duration) || 60000,  // default 60s
        sampleInterval: parseDuration(args['sample-interval']) || 0,  // 0 = back-to-back
    };
}

/**
 * Check a configuration for invalid or missing values before the run starts.
 * @param {Object} cfg - Configuration from buildConfig
 * @returns {Array<string>} Human-readable error messages; empty when the config is valid
 */
function validateConfig(cfg) {
    const errors = [];
    if (!['ramp', 'soak', 'regression', 'inspect', 'ceiling'].includes(cfg.mode)) errors.push(`--mode must be "ramp", "soak", "regression", "inspect", or "ceiling" (got "${cfg.mode}")`);
    if (cfg.recordings.length === 0 && cfg.files.length === 0 && !cfg.dir) errors.push('need --recordings <ids> and/or --files <json,...> / --dir <folder>');
    if (cfg.mode === 'ramp' && (!Number.isInteger(cfg.maxIterations) || cfg.maxIterations < 1)) errors.push('--max-iterations must be a positive integer');
    if (!Number.isFinite(cfg.latencyThreshold) || cfg.latencyThreshold <= 0) errors.push('--latency-threshold must be a positive number');
    if (!Number.isFinite(cfg.failThreshold) || cfg.failThreshold < 0 || cfg.failThreshold > 100) errors.push('--fail-threshold must be a percentage between 0 and 100');
    if (cfg.timingMode !== 'fast' && cfg.timingMode !== 'realtime') errors.push('--timing-mode must be "fast" or "realtime"');
    if (!cfg.password) errors.push('admin password required: pass --password or set PERF_ADMIN_PASSWORD');
    return errors;
}

/**
 * Open a Socket.IO connection using the session cookie and wait for the
 * server's ready signal before resolving.
 * @param {string} serverUrl - Target server, e.g. http://localhost:3001
 * @param {string} cookie - The "connect.sid=..." session cookie
 * @returns {Promise<Object>} The connected socket
 * @throws {Error} If the connection fails or no ready signal arrives in time
 */
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

/**
 * Emit a socket event and wait for the server's acknowledgement.
 * @param {Object} socket - Connected Socket.IO client from connectSocket
 * @param {string} event - Event name to emit
 * @param {Object} payload - Event payload sent as the emit's first argument; defaults to {} when omitted
 * @param {number} [timeoutMs=5000] - Ack timeout in ms; 0 disables the timeout
 * @returns {Promise<Object>} The acknowledgement payload
 * @throws {Error} If no acknowledgement arrives before the timeout
 */
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
 * Confirm the connected session has admin rights by calling an admin-guarded
 * handler. Replay requires admin, so fail fast here rather than mid-run.
 * @param {Object} socket - Connected Socket.IO client
 * @returns {Promise<Object>} The handler's acknowledgement payload
 * @throws {Error} If the session lacks admin access
 */
async function verifyAdminAccess(socket) {
    const res = await emitWithAck(socket, 'recordingGetOnlineSessions', {});
    // createSocket acks are { success: bool, data?, message? }.
    if (res && res.success) return;
    const msg = (res && res.message) || 'unknown error';
    throw new Error('Configured account is not admin (recordingGetOnlineSessions rejected: ' + msg + '). Use an admin account.');
}

/**
 * Run one perf session: authenticate, connect, verify admin access, then
 * dispatch to the handler for the configured mode.
 * @param {Object} cfg - Validated run configuration: server, user, password, mode, plus the mode-specific fields consumed by the mode handler
 * @throws {Error} If login, connection, or admin verification fails
 */
async function run(cfg) {
    console.log('\nLogging in as "' + cfg.user + '" at ' + cfg.server + ' ...');
    const cookie = await login(cfg.server, cfg.user, cfg.password);
    const user = await verifyAuthenticatedSession(cfg.server, cookie);
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
        const { runRegression } = require('./regression');
        const code = await runRegression(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'inspect') {
        const { runInspect } = require('./inspect');
        const code = await runInspect(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'ramp') {
        const { runRamp } = require('./ramp');
        const code = await runRamp(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'ceiling') {
        const { runCeiling } = require('./ceiling');
        const { code } = await runCeiling(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }
    if (cfg.mode === 'soak') {
        const { runSoak } = require('./soak');
        const code = await runSoak(cfg, ctx);
        socket.disconnect();
        process.exit(code);
    }

    // Every valid mode is dispatched and exits above; validateConfig rejects
    // anything else, so this point is unreachable. Guard anyway rather than
    // hang silently on an unhandled mode.
    throw new Error(`No handler for mode "${cfg.mode}"`);
}

/**
 * CLI entry point: parse arguments, prompt for a password when needed,
 * validate the configuration, and start the run.
 * @returns {Promise<void>} Resolves when the run completes
 */
async function main() {
    const cfg = buildConfig(parseArgs(process.argv.slice(2)));

    // No password from --password or env (e.g. a deployed/test box without the
    // perf env vars): prompt for it interactively rather than failing outright.
    // A non-TTY environment (CI, piped input) can't prompt — there env/flag is
    // the only path, and validateConfig below will report the missing password.
    if (!cfg.password && process.stdin.isTTY) {
        cfg.password = await promptPassword();
    }

    const errors = validateConfig(cfg);
    if (errors.length > 0) {
        console.error('Invalid configuration:');
        for (const e of errors) console.error('  - ' + e);
        console.error('\nExample:\n  PERF_ADMIN_PASSWORD=... npm run perf -- --mode ramp --recordings 12,15 --max-iterations 30\n  PERF_ADMIN_PASSWORD=... npm run perf -- --mode regression --dir stories/');
        process.exit(1);
    }

    console.log('CARE perf — configuration');
    console.log('  mode:          ' + cfg.mode);
    console.log('  recordings:    ' + (cfg.recordings.length ? cfg.recordings.join(', ') : '—'));
    if (cfg.files.length) console.log('  files:         ' + cfg.files.join(', '));
    if (cfg.dir) console.log('  dir:           ' + cfg.dir);
    // Only ramp (levels to climb) and ceiling (hard cap on levels) use this.
    // Echoing it for soak, regression and inspect implies a knob that does
    // nothing in those modes.
    if (cfg.mode === 'ramp' || cfg.mode === 'ceiling') {
        console.log('  maxIterations: ' + cfg.maxIterations);
    }
    console.log('  server:        ' + cfg.server);
    console.log('  user:          ' + cfg.user);

    run(cfg).then(() => process.exit(0)).catch(err => {
        console.error('\nperf error: ' + err.message);
        process.exit(1);
    });
}

main();