'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Validate an exported recording payload (schemaVersion 1). Throws on any issue.
 * @param {Object} p - parsed JSON
 */
function validatePayload(p) {
    if (!p || typeof p !== 'object') throw new Error('Not a valid JSON object');
    if (p.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${p.schemaVersion}. Expected 1.`);
    if (!p.recording || typeof p.recording !== 'object') throw new Error("Missing 'recording' object");
    if (!Array.isArray(p.traces)) throw new Error("Missing 'traces' array");
}

/**
 * Import one exported recording file into the DB using the same appDataUpdate
 * events the ImportRecordingModal uses, then return the new recording ID.
 * @param {Function} emitWithAck - (event, payload) => Promise<ack>
 * @param {number} userId - the importing (admin) user's id
 * @param {string} filePath - path to the exported JSON
 * @returns {Promise<number>} new recording ID
 */
async function importRecording(emitWithAck, userId, filePath) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validatePayload(json);
    const { recording, traces } = json;

    const participantSocketIds = [...new Set(traces.map(t => t.socketId).filter(Boolean))];

    const recRes = await emitWithAck('appDataUpdate', {
        table: 'recording',
        data: {
            name: recording.name ? `${recording.name} (perf import)` : `Perf import ${Date.now()}`,
            status: recording.status || 'finished',
            startTime: recording.startTime,
            endTime: recording.endTime,
            userId,
            excludeEvents: recording.excludeEvents || null,
            participantUserIds: null,
            participantSocketIds,
        },
    });
    if (!recRes || !recRes.success) {
        throw new Error(`Import failed creating recording from ${filePath}: ${recRes && recRes.message}`);
    }
    const newRecordingId = recRes.data;

    let ok = 0, bad = 0;
    for (const trace of traces) {
        const tRes = await emitWithAck('appDataUpdate', {
            table: 'trace',
            data: {
                recordingId: newRecordingId,
                userId,
                socketId: trace.socketId || null,
                action: trace.action,
                payload: trace.payload || null,
                direction: trace.direction,
                startTime: trace.startTime,
                endTime: trace.endTime,
            },
        });
        if (tRes && tRes.success) ok++; else bad++;
    }
    if (bad > 0) {
        throw new Error(`Import of ${filePath}: ${bad} of ${traces.length} traces failed to import`);
    }

    return newRecordingId;
}

/**
 * Resolve --recordings (DB IDs) and --files (exported JSON) into a flat list of
 * DB recording IDs. Files are imported first; after this, all modes replay by ID
 * regardless of source.
 * @param {Object} cfg - { recordings: number[], files: string[] }
 * @param {Object} ctx - { emitWithAck, userId }
 * @returns {Promise<number[]>} recording IDs ready to replay
 */
async function resolveRecordings(cfg, ctx) {
    const ids = [];
    if (cfg.recordings && cfg.recordings.length) {
        ids.push(...cfg.recordings);
    }
    // --dir: expand a folder of exported recordings into the file list.
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
    if (files.length) {
        for (const f of files) {
            const id = await importRecording(ctx.emitWithAck, ctx.userId, f);
            console.log(`  imported ${path.basename(f)} -> recording ${id}`);
            ids.push(id);
        }
    }
    if (ids.length === 0) {
        throw new Error('No recordings given. Pass --recordings <ids>, --files <json,...>, and/or --dir <folder>');
    }
    return ids;
}

module.exports = { resolveRecordings, importRecording, validatePayload };