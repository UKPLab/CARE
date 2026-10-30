'use strict';

/**
 * Metric sampler: polls the backend's vitals during a run.
 *
 * Two kinds of sample are polled independently, each on its own timer:
 *   health - process memory, event-loop delay, socket count and the DB pool
 *            counters. Answered without a DB query, so it keeps arriving even
 *            when the pool is full.
 *   stats  - Postgres counters (deadlocks, rollbacks, locks, cache hit). Needs
 *            DB queries, so it can stall when the pool is full.
 * A slow stats request therefore cannot delay health. Every tick that brings
 * no fresh data is counted and logged as a gap, so missing data is visible in
 * the report and the saved JSON rather than silently absent.
 */
class MetricSampler {
    /**
     * @param {Function} emitWithAck - Bound (event, payload, timeoutMs) => Promise<ack>
     * @param {number} [intervalMs=1000] - Poll interval for each kind of sample
     * @param {Object} [options] - Per-kind ack timeouts
     * @param {number} [options.healthTimeoutMs=2000] - Give up on a health request after this many ms
     * @param {number} [options.statsTimeoutMs=5000] - Give up on a stats request after this many ms
     */
    constructor(emitWithAck, intervalMs = 1000, options = {}) {
        this.emit = emitWithAck;
        this.intervalMs = intervalMs;
        this.kinds = {
            health: { event: 'recordingGetPerfHealth', timeoutMs: options.healthTimeoutMs || 2000 },
            stats: { event: 'recordingGetPerfStats', timeoutMs: options.statsTimeoutMs || 5000 },
        };
        this.samples = [];
        this.gaps = [];
        this.counts = { health: { tried: 0, missed: 0 }, stats: { tried: 0, missed: 0 } };
        this._inFlight = { health: null, stats: null };
        this._timers = [];
    }

    /**
     * Take one sample of one kind. A tick that arrives while the previous
     * request of the same kind is still waiting counts as missed: no fresh
     * data was collected for that second.
     * @param {string} kind - "health" or "stats"
     * @returns {Promise<void>}
     */
    async _poll(kind) {
        const counts = this.counts[kind];
        counts.tried++;
        if (this._inFlight[kind]) {
            counts.missed++;
            this.gaps.push({ t: Date.now(), kind, reason: 'previous request still waiting' });
            return;
        }
        const { event, timeoutMs } = this.kinds[kind];
        const request = (async () => {
            const t = Date.now();
            try {
                const ack = await this.emit(event, {}, timeoutMs);
                if (ack && ack.success) {
                    this.samples.push({
                        t,
                        health: kind === 'health' ? ack.data : null,
                        stats: kind === 'stats' ? ack.data : null,
                    });
                } else {
                    counts.missed++;
                    this.gaps.push({ t, kind, reason: (ack && ack.message) || 'request rejected' });
                }
            } catch (err) {
                counts.missed++;
                this.gaps.push({ t, kind, reason: err.message });
            }
        })();
        this._inFlight[kind] = request;
        try {
            await request;
        } finally {
            this._inFlight[kind] = null;
        }
    }

    /**
     * Start sampling. Takes one sample of each kind, then polls both on the interval.
     * @returns {Promise<void>} Resolves once the first samples are in (or missed)
     */
    async start() {
        this.samples = [];
        this.gaps = [];
        this.counts = { health: { tried: 0, missed: 0 }, stats: { tried: 0, missed: 0 } };
        await Promise.all([this._poll('health'), this._poll('stats')]);
        for (const kind of Object.keys(this.kinds)) {
            this._timers.push(setInterval(() => this._poll(kind), this.intervalMs));
        }
    }

    /**
     * Stop sampling: wait for requests still in flight, then take one final
     * sample of each kind.
     * @returns {Promise<void>}
     */
    async stop() {
        for (const timer of this._timers) {
            clearInterval(timer);
        }
        this._timers = [];
        await Promise.all(Object.values(this._inFlight).filter(Boolean));
        await Promise.all([this._poll('health'), this._poll('stats')]);
    }

    /** @returns {Array<Object>} Every sample in arrival order: {t, health, stats}, one of the two set */
    getSamples() {
        return this.samples;
    }

    /** @returns {Array<Object>} Every missed tick: {t, kind, reason} */
    getGaps() {
        return this.gaps;
    }

    /** @returns {{health: {tried: number, missed: number}, stats: {tried: number, missed: number}}} How many samples were attempted and missed per kind */
    coverage() {
        return {
            health: { ...this.counts.health },
            stats: { ...this.counts.stats },
        };
    }

    /**
     * Every DB pool reading, from both health (in-memory counters) and stats.
     * @param {number} [since=0] - Only readings taken at or after this timestamp
     * @returns {Array<Object>} Pool snapshots ({max, size, using, waiting, ...})
     */
    _poolReadings(since = 0) {
        const out = [];
        for (const s of this.samples) {
            if (s.t < since) {
                continue;
            }
            const pool = (s.health && s.health.pool) || (s.stats && s.stats.sequelizePool);
            if (pool && typeof pool.waiting === 'number') {
                out.push(pool);
            }
        }
        return out;
    }

    /** @returns {number} Most recent pool waiting count, 0 if none was read */
    latestPoolWaiting() {
        const readings = this._poolReadings();
        return readings.length ? readings[readings.length - 1].waiting : 0;
    }

    /**
     * Peak pool waiting count. Waiting > 0 means requests queued for a DB connection.
     * @param {number} [since=0] - Only readings taken at or after this timestamp
     * @returns {number} Peak waiting count, 0 if none was read
     */
    peakPoolWaiting(since = 0) {
        return this._poolReadings(since).reduce((peak, p) => Math.max(peak, p.waiting), 0);
    }

    /**
     * Peak waiting count while the pool was at its maximum size. The pool opens
     * connections on demand, so a request can wait briefly while a new
     * connection is being opened even though the pool is far from full. Only
     * waiting while every connection exists means requests queued for a busy pool.
     * @param {number} [since=0] - Only readings taken at or after this timestamp
     * @returns {number} Peak waiting count at max size, 0 if the pool never reached max
     */
    peakPoolWaitingWhenFull(since = 0) {
        return this._poolReadings(since)
            .filter(p => typeof p.max === 'number' && (p.size ?? p.using ?? 0) >= p.max)
            .reduce((peak, p) => Math.max(peak, p.waiting), 0);
    }

    /** @returns {{max: (number|null), peakSize: number, peakUsing: number, peakWaiting: number, peakWaitingWhenFull: number}|null} DB pool summary, null if no reading */
    poolSummary() {
        const readings = this._poolReadings();
        if (readings.length === 0) {
            return null;
        }
        return {
            max: readings[readings.length - 1].max ?? null,
            peakSize: readings.reduce((peak, p) => Math.max(peak, p.size || 0), 0),
            peakUsing: readings.reduce((peak, p) => Math.max(peak, p.using || 0), 0),
            peakWaiting: readings.reduce((peak, p) => Math.max(peak, p.waiting), 0),
            peakWaitingWhenFull: this.peakPoolWaitingWhenFull(),
        };
    }

    /**
     * Health readings of one numeric field.
     * @param {string} field - Key on the health payload, e.g. "rss"
     * @returns {Array<number>} Values in time order
     */
    _healthSeries(field) {
        return this.samples
            .filter(s => s.health && typeof s.health[field] === 'number')
            .map(s => s.health[field]);
    }

    /**
     * First, middle and last value of a series.
     * @param {Array<number>} series - Values in time order
     * @returns {{first: number, mid: number, last: number}} 0s when empty
     */
    _trend(series) {
        if (series.length === 0) {
            return { first: 0, mid: 0, last: 0 };
        }
        return { first: series[0], mid: series[Math.floor(series.length / 2)], last: series[series.length - 1] };
    }

    /** @returns {{first: number, mid: number, last: number}} RSS in bytes at start, middle and end */
    rssTrend() {
        return this._trend(this._healthSeries('rss'));
    }

    /** @returns {{first: number, mid: number, last: number}} heapUsed in bytes at start, middle and end */
    heapTrend() {
        return this._trend(this._healthSeries('heapUsed'));
    }

    /** @returns {number} Peak RSS in bytes */
    peakRss() {
        return Math.max(0, ...this._healthSeries('rss'));
    }

    /** @returns {number} Peak heapUsed in bytes */
    peakHeap() {
        return Math.max(0, ...this._healthSeries('heapUsed'));
    }

    /**
     * Open file descriptors of the backend process (files, sockets, pipes) at
     * start, middle and end, the peak, and the process limit when known. A
     * count that climbs and does not come back down after load is a leak.
     * @returns {{first: number, mid: number, last: number, peak: number, limit: (number|null)}|null} null if the server sent no counts
     */
    openFilesSummary() {
        const series = this._healthSeries('openFiles');
        if (series.length === 0) {
            return null;
        }
        const limits = this._healthSeries('openFilesLimit');
        return {
            ...this._trend(series),
            peak: Math.max(...series),
            limit: limits.length ? limits[limits.length - 1] : null,
        };
    }

    /** @returns {number|null} Peak connected socket count, null if never read */
    peakSockets() {
        const series = this._healthSeries('socketCount');
        return series.length ? Math.max(...series) : null;
    }

    /**
     * Event-loop delay across the run. Each health reading covers the time
     * since the previous one, so the max over readings is the worst stall.
     * @returns {{maxMs: number, worstP99Ms: number}|null} null if the server sent no event-loop data
     */
    eventLoopSummary() {
        const loops = this.samples.filter(s => s.health && s.health.eventLoop).map(s => s.health.eventLoop);
        if (loops.length === 0) {
            return null;
        }
        return {
            maxMs: Math.max(0, ...loops.map(l => l.maxMs || 0)),
            worstP99Ms: Math.max(0, ...loops.map(l => l.p99Ms || 0)),
        };
    }

    /**
     * Postgres counters across the run: deadlock and rollback growth (delta
     * of cumulative counters between first and last stats sample), peak
     * waiting locks, and the worst cache-hit % seen.
     * @returns {{deadlocksDelta: number, rollbacksDelta: number, peakLockWaits: number, minCacheHit: (number|null)}|null} null with fewer than two stats samples
     */
    pgStatsSummary() {
        const withStats = this.samples.filter(s => s.stats && s.stats.dbStats);
        if (withStats.length < 2) {
            return null;
        }
        const first = withStats[0].stats.dbStats;
        const last = withStats[withStats.length - 1].stats.dbStats;
        const num = (v) => (typeof v === 'number' ? v : parseInt(v, 10) || 0);

        let peakLockWaits = 0;
        let minCacheHit = null;
        for (const s of withStats) {
            const lw = s.stats.locks ? num(s.stats.locks.waiting) : 0;
            if (lw > peakLockWaits) {
                peakLockWaits = lw;
            }
            const ch = s.stats.dbStats.cache_hit_pct;
            if (ch != null && (minCacheHit === null || ch < minCacheHit)) {
                minCacheHit = ch;
            }
        }

        return {
            deadlocksDelta: Math.max(0, num(last.deadlocks) - num(first.deadlocks)),
            rollbacksDelta: Math.max(0, num(last.rollbacks) - num(first.rollbacks)),
            peakLockWaits,
            minCacheHit,
        };
    }
}

module.exports = { MetricSampler };
