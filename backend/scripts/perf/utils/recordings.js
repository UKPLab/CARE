'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Validate an exported recording payload (schemaVersion 1). Throws on any issue.
 * @param {Object} p - Parsed recording export; expects { traces: Array<Object> } with optional sessionKey and recordingName
 */
function validatePayload(p) {
    if (!p || typeof p !== 'object') throw new Error('Not a valid JSON object');
    if (p.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${p.schemaVersion}. Expected 1.`);
    if (!p.recording || typeof p.recording !== 'object') throw new Error("Missing 'recording' object");
    if (!Array.isArray(p.traces)) throw new Error("Missing 'traces' array");
}

/**
 * Read exported recording files (and --dir) into replay-ready session payloads,
 * WITHOUT importing to the DB. Each file is one recording; its direction:true
 * traces become one session. Returns [] if no files/dir were given.
 * @param {Object} cfg - { files: string[], dir: string|null }
 * @returns {Array<Object>} sessions: [{ sessionKey, recordingName, traces }]
 */
function loadSessionsFromFiles(cfg) {
    let files = cfg.files ? [...cfg.files] : [];
    if (cfg.dir) {
        const entries = fs.readdirSync(cfg.dir)
            .filter(f => f.toLowerCase().endsWith('.json'))
            .sort()
            .map(f => path.join(cfg.dir, f));
        if (entries.length === 0) {
            throw new Error(`No .json recordings found in folder: ${cfg.dir}`);
        }
        files = files.concat(entries);
    }
    if (files.length === 0) return [];

    const sessions = [];
    for (const f of files) {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(f, 'utf8'));
            validatePayload(json);
        } catch (err) {
            console.warn(`  skipping ${path.basename(f)}: ${err.message}`);
            continue;
        }
        const name = (json.recording && json.recording.name) || path.basename(f);
        sessions.push({
            sessionKey: path.basename(f),
            recordingName: name,
            traces: json.traces,
        });
        console.log(`  loaded ${path.basename(f)} (${json.traces.length} traces) — no import`);
    }
    return sessions;
}

/**
 * Resolve a run's input into exactly one of { recordingIds } (DB path) or
 * { sessions } (file path). --recordings are DB IDs; --files/--dir are replayed
 * straight from disk with no import. A run is one or the other, not both.
 * @param {Object} cfg - { recordings: number[], files: string[], dir: string|null }
 * @param {Object} ctx - unused; kept so all resolve helpers share one signature
 * @returns {Promise<{recordingIds: number[], sessions: Array<Object>}>}
 */
async function resolvePayload(cfg, ctx) {
    const sessions = loadSessionsFromFiles(cfg);
    const recordingIds = (cfg.recordings && cfg.recordings.length) ? [...cfg.recordings] : [];

    if (sessions.length && recordingIds.length) {
        throw new Error('Use --recordings (DB) or --files/--dir (files), not both');
    }
    if (!sessions.length && !recordingIds.length) {
        throw new Error('No recordings given. Pass --recordings <ids> or --files <json,...> / --dir <folder>');
    }
    return { recordingIds, sessions };
}

module.exports = { validatePayload, loadSessionsFromFiles, resolvePayload };