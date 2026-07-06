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

    /** RSS trend: {first, last} in bytes, for memory-growth detection. */
    rssTrend() {
        const withHealth = this.samples.filter(s => s.health);
        if (withHealth.length === 0) return { first: 0, last: 0 };
        return { first: withHealth[0].health.rss, last: withHealth[withHealth.length - 1].health.rss };
    }
}

module.exports = { MetricSampler };