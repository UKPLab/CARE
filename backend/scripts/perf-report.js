'use strict';

const fs = require('fs');
const path = require('path');
const { traceStats } = require('./perf-trace-stats');

/**
 * Persist a perf run's complete results to a local JSON file, so results
 * survive backend crashes and long runs don't need re-running to re-inspect.
 * Captures MORE than the terminal shows: full raw sampler data (every memory/
 * pg reading), complete per-trace stats, config, and verdict.
 *
 * @param {string} mode - which mode ran (soak, ceiling, ramp, regression)
 * @param {Object} cfg - the run's config
 * @param {Object} payload - mode-specific data: { results, samples, sampler, verdict, extra }
 * @returns {string|null} the file path written, or null on failure
 */
function saveResults(mode, cfg, payload = {}) {
    try {
        const dir = path.join(process.cwd(), 'perf-results');
        fs.mkdirSync(dir, { recursive: true });

        const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
        const file = path.join(dir, `${ts}-${mode}.json`);

        const doc = {
            mode,
            when: new Date().toISOString(),
            config: {
                recordings: cfg.recordings, dir: cfg.dir, files: cfg.files,
                concurrency: cfg.concurrency, duration: cfg.duration,
                step: cfg.step, maxIterations: cfg.maxIterations,
                latencyThreshold: cfg.latencyThreshold, maxFailures: cfg.maxFailures,
            },
            verdict: payload.verdict || null,
            // Per-trace-type stats (errorMsgs Map converted to plain object).
            traceStats: payload.results ? traceStats(payload.results).map(s => ({
                ...s, errorMsgs: Object.fromEntries(s.errorMsgs || []),
            })) : null,
            // Mode-specific per-level/per-sample metrics (the table rows).
            metrics: payload.metrics || null,
            // Full raw server vitals — every 1s reading (memory + complete pg data).
            vitals: payload.sampler ? payload.sampler.getSamples() : null,
            // Raw session results (per-trace latencies, errors, dbChanges, ts).
            rawResults: payload.results || null,
        };

        fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
        return file;
    } catch (err) {
        console.error('  (could not save results file: ' + err.message + ')');
        return null;
    }
}

/**
 * Tee console.log to an in-memory buffer while still printing to screen.
 * Call start() at the beginning of a run, stop() to get the captured text.
 * Lets us save a .txt report byte-identical to what the user saw live.
 */
function makeOutputCapture() {
    const buffer = [];
    const original = console.log;
    return {
        start() {
            console.log = (...args) => {
                buffer.push(args.join(' '));
                original(...args);
            };
        },
        stop() {
            console.log = original;
            return buffer.join('\n');
        },
    };
}

/**
 * Save a readable text report next to the JSON (same base name, .txt).
 * @param {string} jsonPath - the JSON file path returned by saveResults
 * @param {string} text - the captured terminal output
 * @returns {string|null} the .txt path, or null
 */
function saveReadableReport(jsonPath, text) {
    try {
        if (!jsonPath) return null;
        const txtPath = jsonPath.replace(/\.json$/, '.txt');
        fs.writeFileSync(txtPath, text, 'utf8');
        return txtPath;
    } catch (err) {
        return null;
    }
}

module.exports = { saveResults, makeOutputCapture, saveReadableReport };