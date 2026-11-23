/**
 * Unit tests for the perf CLI's counting and stop rules (scripts/perf).
 *
 * These cover the pure functions behind the load reports: how replayed
 * requests are counted (ok, failed, no reply), latency percentiles, ceiling's
 * stop conditions, and when DB pool waiting counts as saturation. No server
 * or database is involved; inputs are hand-built session results and
 * sampler samples.
 *
 * @author Ilyas Mohammed
 */

const { percentile, levelMetrics, stopConditionsMet } = require("../scripts/perf/utils/summary");
const { MetricSampler } = require("../scripts/perf/utils/metrics");

/**
 * Build one replayed session's result in the shape replayUserTraces returns.
 * @param {Object} counts - { passed, failed, noAck }
 * @param {Array<number>} latencies - Latencies in ms of the answered requests
 * @returns {Object} Session result
 */
function session({ passed = 0, failed = 0, noAck = 0 }, latencies = []) {
    return {
        total: passed + failed + noAck,
        passed,
        failed,
        noAck,
        latencies: latencies.map(latency => ({ action: "a", latency })),
    };
}

// Stop rules as the CLI defaults them, so each test changes one thing.
const cfg = { maxFailures: 0, failThreshold: 5, latencyThreshold: 1000 };

describe("percentile", () => {
    test("returns 0 for an empty list", () => {
        expect(percentile([], 95)).toBe(0);
    });

    test("reads the value at the percentile of a sorted list", () => {
        const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(percentile(sorted, 50)).toBe(6);
        expect(percentile(sorted, 95)).toBe(10);
    });
});

describe("levelMetrics", () => {
    test("counts ok, failed and no-reply requests separately", () => {
        const m = levelMetrics([
            session({ passed: 3, failed: 1, noAck: 2 }, [10, 20, 30]),
            session({ passed: 2 }, [40, 50]),
        ], 1000);
        expect(m).toMatchObject({ sessions: 2, sent: 8, ok: 5, failed: 1, noAck: 2, noAckPct: 25 });
    });

    test("measures latency over answered requests only", () => {
        const m = levelMetrics([session({ passed: 2, noAck: 98 }, [10, 30])], 1000);
        expect(m.avg).toBe(20);
        expect(m.max).toBe(30);
    });

    test("an empty latency list gives zeros, not NaN", () => {
        const m = levelMetrics([session({ noAck: 4 })], 1000);
        expect(m).toMatchObject({ avg: 0, p50: 0, p95: 0, max: 0, noAckPct: 100 });
    });

    test("sent = 0 and duration 0 give zeros", () => {
        const m = levelMetrics([], 0);
        expect(m).toMatchObject({ sessions: 0, sent: 0, noAckPct: 0, perSec: 0 });
    });

    test("answered per second counts ok and failed, not no-reply", () => {
        const m = levelMetrics([session({ passed: 6, failed: 2, noAck: 10 }, [1, 1, 1, 1, 1, 1])], 2000);
        expect(m.perSec).toBe(4);
    });
});

describe("stopConditionsMet", () => {
    const base = { sent: 100, failed: 0, noAck: 0, p95: 10 };

    test("a healthy level meets no condition", () => {
        expect(stopConditionsMet(base, 0, cfg)).toEqual([]);
    });

    test("stops on more failures than --max-failures", () => {
        const reasons = stopConditionsMet({ ...base, failed: 1 }, 0, cfg);
        expect(reasons).toHaveLength(1);
        expect(reasons[0]).toMatch(/--max-failures/);
    });

    test("no-reply requests count toward --fail-threshold", () => {
        const reasons = stopConditionsMet({ ...base, noAck: 6 }, 0, cfg);
        expect(reasons).toHaveLength(1);
        expect(reasons[0]).toMatch(/--fail-threshold/);
    });

    test("no-reply below --fail-threshold does not stop", () => {
        expect(stopConditionsMet({ ...base, noAck: 5 }, 0, cfg)).toEqual([]);
    });

    test("stops on p95 above --latency-threshold", () => {
        const reasons = stopConditionsMet({ ...base, p95: 1001 }, 0, cfg);
        expect(reasons[0]).toMatch(/--latency-threshold/);
    });

    test("stops on requests waiting while the pool is full", () => {
        const reasons = stopConditionsMet(base, 2, cfg);
        expect(reasons[0]).toMatch(/every pool connection was in use/);
    });

    test("sent = 0 does not divide by zero", () => {
        expect(stopConditionsMet({ sent: 0, failed: 0, noAck: 0, p95: 0 }, 0, cfg)).toEqual([]);
    });

    test("lists every condition met", () => {
        const reasons = stopConditionsMet({ sent: 10, failed: 2, noAck: 3, p95: 2000 }, 1, cfg);
        expect(reasons).toHaveLength(4);
    });
});

describe("MetricSampler pool readings", () => {
    /**
     * A sampler with hand-set samples, never started (no server needed).
     * @param {Array<Object>} samples - {t, health, stats} entries
     * @returns {MetricSampler} The sampler
     */
    function samplerWith(samples) {
        const sampler = new MetricSampler(null);
        sampler.samples = samples;
        return sampler;
    }

    test("waiting while the pool is still growing is not saturation", () => {
        const sampler = samplerWith([{ t: 1, health: { pool: { max: 45, size: 10, using: 10, waiting: 1 } }, stats: null }]);
        expect(sampler.peakPoolWaiting()).toBe(1);
        expect(sampler.peakPoolWaitingWhenFull()).toBe(0);
    });

    test("waiting at max size is saturation", () => {
        const sampler = samplerWith([{ t: 1, health: { pool: { max: 45, size: 45, using: 45, waiting: 3 } }, stats: null }]);
        expect(sampler.peakPoolWaitingWhenFull()).toBe(3);
    });

    test("reads the pool from stats samples too, and honours since", () => {
        const sampler = samplerWith([
            { t: 1, health: null, stats: { sequelizePool: { max: 45, size: 45, using: 45, waiting: 4 } } },
            { t: 5, health: { pool: { max: 45, size: 45, using: 40, waiting: 0 } }, stats: null },
        ]);
        expect(sampler.peakPoolWaitingWhenFull()).toBe(4);
        expect(sampler.peakPoolWaitingWhenFull(5)).toBe(0);
    });

    test("no pool readings give 0 and no summary", () => {
        const sampler = samplerWith([]);
        expect(sampler.peakPoolWaitingWhenFull()).toBe(0);
        expect(sampler.poolSummary()).toBeNull();
    });
});
