'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const DAY_MS = 86400000;

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

/** One writer per process; the configured path supplies the directory and filename stem. */
function createCsvStore(basePath) {
    const parsed = path.parse(path.resolve(basePath));
    const prefix = parsed.name + '-';
    let queue = Promise.resolve();
    function enqueue(operation) {
        const result = queue.then(operation);
        queue = result.catch(() => {});
        return result;
    }
    return {
        write(snap, intervalMs, now = new Date()) {
            const day = now.toISOString().slice(0, 10);
            return enqueue(async () => {
                await fs.mkdir(parsed.dir, { recursive: true });
                const row = { counts: snap.counts, oldestActive: snap.oldestActive,
                    sequelizePool: snap.sequelizePool, dbStats: snap.dbStats, locks: snap.locks,
                    intervalMs, collectedAt: snap.collectedAt };
                const file = await fs.open(path.join(parsed.dir, `${prefix}${day}.csv`), 'a');
                try {
                    const header = (await file.stat()).size === 0
                        ? Object.keys(row).map(escapeCsv).join(',') + '\n' : '';
                    await file.appendFile(header + Object.values(row).map(escapeCsv).join(',') + '\n', 'utf8');
                } finally {
                    await file.close();
                }
            });
        },
        cleanup(config, logger, now = new Date()) {
            return enqueue(async () => {
                // Check at execution time too, so queued cleanup respects disabling deletion.
                if (!config.autoDelete || !Number.isInteger(config.retentionDays) || config.retentionDays < 1) return;
                const today = now.toISOString().slice(0, 10);
                const cutoff = new Date(Date.parse(today) - config.retentionDays * DAY_MS).toISOString().slice(0, 10);
                let entries;
                try {
                    entries = await fs.readdir(parsed.dir, { withFileTypes: true });
                } catch (error) {
                    if (error.code === 'ENOENT') return;
                    throw error;
                }
                for (const entry of entries) {
                    if (!config.autoDelete) break;
                    if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
                    const date = entry.name.slice(prefix.length, -4);
                    if (!entry.name.endsWith('.csv') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
                    const timestamp = Date.parse(date);
                    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) continue;
                    if (date >= cutoff || date >= today) continue;
                    try {
                        await fs.unlink(path.join(parsed.dir, entry.name));
                    } catch (error) {
                        if (error.code !== 'ENOENT') logger.error(`pg_stats cleanup failed for ${entry.name}: ${error.message}`);
                    }
                }
            });
        },
        drain() { return queue; },
    };
}

module.exports = { createCsvStore };
