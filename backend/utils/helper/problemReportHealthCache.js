/**
 * Database health snapshots shown in the problem report form, kept until the report is submitted.
 *
 * The snapshot is captured on the server when the form opens (problemReportPrepare)
 * and saved with the report on submit, so the stored snapshot is the one the user
 * saw and clients cannot supply their own numbers. Entries are keyed by user and
 * form id (clientRequestId), expire after the configured age and are bounded in
 * number per user and in total. A user gets at most one capture at a time, and a
 * capture younger than MIN_CAPTURE_INTERVAL_MS is reused instead of querying again.
 *
 * @author Akash Gundapuneni
 */

const MAX_ENTRIES = 1000;
const MAX_ENTRIES_PER_USER = 3;
const MIN_CAPTURE_INTERVAL_MS = 5000;

class DatabaseHealthCache {
    constructor({maxEntries = MAX_ENTRIES, maxEntriesPerUser = MAX_ENTRIES_PER_USER, minCaptureIntervalMs = MIN_CAPTURE_INTERVAL_MS} = {}) {
        this.maxEntries = maxEntries;
        this.maxEntriesPerUser = maxEntriesPerUser;
        this.minCaptureIntervalMs = minCaptureIntervalMs;
        /** @type {Map<string, {userId: number, snapshot: Object, capturedAt: number, expiresAt: number}>} */
        this.entries = new Map();
        /** @type {Map<number, Promise<Object>>} running capture per user */
        this.capturing = new Map();
    }

    key(userId, clientRequestId) {
        return `${userId}:${clientRequestId}`;
    }

    /**
     * @param {number} userId
     * @param {string} clientRequestId
     * @param {number} [now]
     * @returns {{snapshot: Object, expiresAt: number}|null} The unexpired entry of this user's form
     */
    get(userId, clientRequestId, now = Date.now()) {
        this.prune(now);
        const entry = this.entries.get(this.key(userId, clientRequestId));
        return entry && entry.userId === userId ? {snapshot: entry.snapshot, expiresAt: entry.expiresAt} : null;
    }

    /**
     * Store a snapshot for one form, replacing an earlier one and evicting the oldest entries over the limits.
     *
     * @param {number} userId
     * @param {string} clientRequestId
     * @param {Object} snapshot
     * @param {number} maxAgeMs How long after its capture the snapshot can be saved with a report
     * @param {number} [capturedAt] Capture time in ms
     * @returns {{snapshot: Object, expiresAt: number}}
     */
    set(userId, clientRequestId, snapshot, maxAgeMs, capturedAt = Date.now()) {
        const key = this.key(userId, clientRequestId);
        this.entries.delete(key);
        const entry = {userId, snapshot, capturedAt, expiresAt: capturedAt + maxAgeMs};
        this.entries.set(key, entry);
        const own = [...this.entries.entries()].filter(([, value]) => value.userId === userId);
        own.slice(0, Math.max(0, own.length - this.maxEntriesPerUser)).forEach(([oldKey]) => this.entries.delete(oldKey));
        while (this.entries.size > this.maxEntries) {
            this.entries.delete(this.entries.keys().next().value);
        }
        return {snapshot, expiresAt: entry.expiresAt};
    }

    delete(userId, clientRequestId) {
        this.entries.delete(this.key(userId, clientRequestId));
    }

    prune(now = Date.now()) {
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key);
            }
        }
    }

    /**
     * Capture a snapshot for a user's form, reusing a very recent or running capture of the same user.
     *
     * @param {number} userId
     * @param {string} clientRequestId
     * @param {function(): Promise<Object>} capture Takes the snapshot; must not throw
     * @param {number} maxAgeMs How long the snapshot can be saved with a report
     * @returns {Promise<{snapshot: Object, expiresAt: number}>}
     */
    async capture(userId, clientRequestId, capture, maxAgeMs) {
        const now = Date.now();
        this.prune(now);
        const recent = [...this.entries.values()]
            .filter((entry) => entry.userId === userId && now - entry.capturedAt < this.minCaptureIntervalMs)
            .pop();
        if (recent) {
            return this.set(userId, clientRequestId, recent.snapshot, maxAgeMs, recent.capturedAt);
        }
        if (!this.capturing.has(userId)) {
            this.capturing.set(userId, Promise.resolve()
                .then(capture)
                .finally(() => this.capturing.delete(userId)));
        }
        const snapshot = await this.capturing.get(userId);
        return this.set(userId, clientRequestId, snapshot, maxAgeMs);
    }
}

/**
 * The part of a database health snapshot the reporting user may see.
 *
 * Pool usage, connection and lock counts, deadlocks and the other counters describe
 * the server's capacity and load, so they are saved with the report for
 * administrators but never sent to the reporting browser.
 *
 * @param {Object|null} snapshot Full snapshot (see currentDatabaseHealth)
 * @returns {{status: string, reason?: string, capturedAt: string, restricted: true}|null}
 */
function publicDatabaseHealth(snapshot) {
    if (!snapshot) return null;
    const view = {status: snapshot.status, capturedAt: snapshot.capturedAt, restricted: true};
    if (snapshot.reason) view.reason = snapshot.reason;
    return view;
}

module.exports = {DatabaseHealthCache, databaseHealthCache: new DatabaseHealthCache(), publicDatabaseHealth};
