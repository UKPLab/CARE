const {currentDatabaseHealth} = require("../db/stats.js");
const {DatabaseHealthCache} = require("../utils/helper/problemReportHealthCache.js");

const SECRET = "SELECT * FROM document WHERE text = 'private draft'";

/**
 * Minimal Sequelize stand-in: one transaction, configurable query result and pool.
 * @param {function(string, Object): Promise} query Called for every query
 * @returns {Object}
 */
const fakeSequelize = (query) => ({
    queries: [],
    connectionManager: {pool: {max: 5, min: 0, size: 2, available: 1, using: 1, waiting: 3, name: "pool"}},
    transaction(callback) {
        return Promise.resolve().then(() => callback({}));
    },
    query(sql, options) {
        this.queries.push({sql, options});
        return query(sql, options);
    },
});

const ROW = {
    connections_total: "4",
    connections_active: "1",
    connections_idle: "2",
    connections_idle_in_transaction: "1",
    connections_waiting_on_lock: "0",
    longest_active_query_ms: "1500",
    longest_transaction_ms: "2500",
    locks_total: "7",
    locks_waiting: "1",
    locks_by_mode: {AccessShareLock: 5, RowExclusiveLock: "2", [SECRET]: 9},
    xact_commit: "90",
    xact_rollback: "10",
    blks_hit: "99",
    blks_read: "1",
    deadlocks: "0",
    conflicts: "0",
    temp_files: "0",
    temp_bytes: "0",
    stats_reset: null,
    // Columns that must never reach a report even if a query returned them
    query: SECRET,
    client_addr: "10.0.0.7",
    datname: "care",
    usename: "postgres",
    pid: 4242,
};

describe("current database health snapshot", () => {
    test("returns only aggregate numbers of the current database", async () => {
        const sequelize = fakeSequelize(async (sql) => (sql.includes("set_config") ? [[{}]] : [[ROW]]));
        const health = await currentDatabaseHealth(sequelize, {timeoutMs: 500});

        expect(health.status).toBe("ok");
        expect(health.connections).toEqual({total: 4, active: 1, idle: 2, idleInTransaction: 1, waitingOnLock: 0});
        expect(health.locks).toEqual({total: 7, waiting: 1, byMode: {AccessShareLock: 5, RowExclusiveLock: 2}});
        expect(health.transactions).toEqual({commits: 90, rollbacks: 10, rollbackPct: 10});
        expect(health.cache.hitPct).toBe(99);
        expect(health.pool).toEqual({max: 5, min: 0, size: 2, available: 1, using: 1, waiting: 3});
        const text = JSON.stringify(health);
        for (const leaked of ["private draft", "10.0.0.7", "postgres", "4242", "\"care\""]) {
            expect(text).not.toContain(leaked);
        }

        // The statement timeout is passed as a bound value, and the query is limited to the current database
        const [setTimeoutQuery, healthQuery] = sequelize.queries;
        expect(setTimeoutQuery.options.replacements).toEqual({timeout: "500"});
        expect(healthQuery.sql).toContain("datname = current_database()");
        expect(healthQuery.sql).not.toMatch(/\bquery\b\s*(,|AS|FROM)/i);
        expect(healthQuery.sql).not.toContain("client_addr");
    });

    test("a slow database yields an unavailable snapshot within the timeout, with pool usage", async () => {
        const sequelize = fakeSequelize((sql) => (sql.includes("set_config") ? Promise.resolve([[{}]]) : new Promise(() => {})));
        const started = Date.now();
        const health = await currentDatabaseHealth(sequelize, {timeoutMs: 100});
        expect(Date.now() - started).toBeLessThan(2000);
        expect(health).toMatchObject({status: "unavailable", reason: "timeout", pool: {waiting: 3}});
        expect(health).not.toHaveProperty("connections");
    });

    test("database errors are reported without their message", async () => {
        const logged = [];
        const logger = {warn: (message) => logged.push(message)};
        const error = Object.assign(new Error(`permission denied: ${SECRET}`), {original: {code: "42501"}});
        const sequelize = fakeSequelize(async (sql) => {
            if (sql.includes("set_config")) return [[{}]];
            throw error;
        });
        const health = await currentDatabaseHealth(sequelize, {timeoutMs: 500, logger});
        expect(health).toMatchObject({status: "unavailable", reason: "error"});
        expect(JSON.stringify(health)).not.toContain("private draft");
        expect(logged.join(" ")).toContain("42501");
        expect(logged.join(" ")).not.toContain("private draft");

        const cancelled = fakeSequelize(async (sql) => {
            if (sql.includes("set_config")) return [[{}]];
            throw Object.assign(new Error("canceling statement due to statement timeout"), {original: {code: "57014"}});
        });
        expect((await currentDatabaseHealth(cancelled, {timeoutMs: 500})).reason).toBe("timeout");
    });
});

describe("database health cache", () => {
    const snapshot = (n) => ({status: "ok", n});

    test("snapshots belong to one user and form and expire", async () => {
        const cache = new DatabaseHealthCache({minCaptureIntervalMs: 0});
        await cache.capture(1, "form-a", async () => snapshot(1), 60000);
        expect(cache.get(1, "form-a").snapshot).toEqual(snapshot(1));
        expect(cache.get(2, "form-a")).toBeNull();
        expect(cache.get(1, "form-b")).toBeNull();
        expect(cache.get(1, "form-a", Date.now() + 61000)).toBeNull();
        cache.delete(1, "form-a");
        expect(cache.get(1, "form-a")).toBeNull();
    });

    test("is bounded per user and in total", async () => {
        const cache = new DatabaseHealthCache({maxEntries: 4, maxEntriesPerUser: 2, minCaptureIntervalMs: 0});
        for (const form of ["a", "b", "c"]) {
            await cache.capture(1, form, async () => snapshot(form), 60000);
        }
        expect(cache.get(1, "a")).toBeNull();
        expect(cache.get(1, "c")).not.toBeNull();
        for (const user of [2, 3, 4]) {
            await cache.capture(user, "a", async () => snapshot(user), 60000);
        }
        expect(cache.entries.size).toBe(4);
    });

    test("repeated or concurrent captures of one user query the database once", async () => {
        const cache = new DatabaseHealthCache({minCaptureIntervalMs: 60000});
        let calls = 0;
        const capture = async () => {
            calls += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            return snapshot(calls);
        };
        const [first, second] = await Promise.all([cache.capture(1, "a", capture, 60000), cache.capture(1, "b", capture, 60000)]);
        const third = await cache.capture(1, "c", capture, 60000);
        expect(calls).toBe(1);
        expect(second.snapshot).toBe(first.snapshot);
        // A reused snapshot keeps its original expiry instead of getting a new one
        expect(third.expiresAt).toBeLessThanOrEqual(first.expiresAt);
        await cache.capture(2, "a", capture, 60000);
        expect(calls).toBe(2);
    });
});
