'use strict';

/**
 * Metric sampler: polls the backend's Node-vitals and Postgres-stats endpoints
 * on an interval during a run, collecting timestamped samples. Any mode wraps
 * its run in start()/stop() and reads getSamples() for the trend.
 */
class MetricSampler {
    /**
     * @param {Function} emitWithAck - bound (event, payload, timeoutMs) => Promise<ack>
     * @param {number} intervalMs - poll interval (default 1000)
     */
    constructor(emitWithAck, intervalMs = 1000) {
        this.emit = emitWithAck;
        this.intervalMs = intervalMs;
        this.samples = [];
        this._timer = null;
        this._polling = false;
    }

    async _poll() {
        // Avoid overlapping polls if a sample is slow.
        if (this._polling) return;
        this._polling = true;
        try {
            const [health, stats] = await Promise.all([
                this.emit('recordingGetPerfHealth', {}).catch(() => null),
                this.emit('recordingGetPerfStats', {}).catch(() => null),
            ]);
            this.samples.push({
                t: Date.now(),
                health: health && health.success ? health.data : null,
                stats: stats && stats.success ? stats.data : null,
            });
        } finally {
            this._polling = false;
        }
    }

    /** Start sampling. Takes one immediate sample, then polls on the interval. */
    start() {
        this.samples = [];
        this._poll();
        this._timer = setInterval(() => this._poll(), this.intervalMs);
    }

    /** Stop sampling and take one final sample. */
    async stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        await this._poll();
    }

    getSamples() {
        return this.samples;
    }

    /** Latest Sequelize pool waiting count (0 if unavailable). The pool-exhaustion signal. */
    latestPoolWaiting() {
        for (let i = this.samples.length - 1; i >= 0; i--) {
            const pool = this.samples[i].stats && this.samples[i].stats.sequelizePool;
            if (pool && typeof pool.waiting === 'number') return pool.waiting;
        }
        return 0;
    }

    /** Peak pool waiting across all samples. */
    peakPoolWaiting() {
        let peak = 0;
        for (const s of this.samples) {
            const pool = s.stats && s.stats.sequelizePool;
            if (pool && typeof pool.waiting === 'number' && pool.waiting > peak) peak = pool.waiting;
        }
        return peak;
    }

    /** Peak RSS (bytes) across all samples — for leak detection. */
    peakRss() {
        let peak = 0;
        for (const s of this.samples) {
            if (s.health && s.health.rss > peak) peak = s.health.rss;
        }
        return peak;
    }

    /** Peak heapUsed (bytes) across all samples — often a truer leak signal
     * than RSS, which can inflate from buffers/warmup and then plateau. */
    peakHeap() {
        let peak = 0;
        for (const s of this.samples) {
            if (s.health && typeof s.health.heapUsed === 'number' && s.health.heapUsed > peak) {
                peak = s.health.heapUsed;
            }
        }
        return peak;
    }

    /**
     * Summarize Postgres-side stats across the run: deadlock/rollback growth
     * (delta of cumulative counters between first and last sample), peak
     * waiting locks, and worst cache-hit % seen. Returns null if no samples.
     * @returns {Object|null}
     */
    pgStatsSummary() {
        const withStats = this.samples.filter(s => s.stats && s.stats.dbStats);
        if (withStats.length < 2) return null;
        const first = withStats[0].stats.dbStats;
        const last = withStats[withStats.length - 1].stats.dbStats;
        const num = (v) => (typeof v === 'number' ? v : parseInt(v, 10) || 0);

        let peakLockWaits = 0;
        let minCacheHit = null;
        for (const s of withStats) {
            const lw = s.stats.locks ? num(s.stats.locks.waiting) : 0;
            if (lw > peakLockWaits) peakLockWaits = lw;
            const ch = s.stats.dbStats.cache_hit_pct;
            if (ch != null && (minCacheHit === null || ch < minCacheHit)) minCacheHit = ch;
        }

        return {
            deadlocksDelta: Math.max(0, num(last.deadlocks) - num(first.deadlocks)),
            rollbacksDelta: Math.max(0, num(last.rollbacks) - num(first.rollbacks)),
            peakLockWaits,
            minCacheHit,
        };
    }

    /** RSS trend: {first, last} in bytes, for memory-growth detection. */
    rssTrend() {
        const withHealth = this.samples.filter(s => s.health);
        if (withHealth.length === 0) return { first: 0, last: 0 };
        return { first: withHealth[0].health.rss, last: withHealth[withHealth.length - 1].health.rss };
        
    }

    /** heapUsed trend: {first, last} in bytes, for memory-growth detection. */
    heapTrend() {
        const withHeap = this.samples.filter(s => s.health && typeof s.health.heapUsed === 'number');
        if (withHeap.length === 0) return { first: 0, last: 0 };
        return { first: withHeap[0].health.heapUsed, last: withHeap[withHeap.length - 1].health.heapUsed };
    }
    
}

module.exports = { MetricSampler };