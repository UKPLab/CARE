/**
 * Periodic PostgreSQL statistics, stored in daily UTC CSV files.
 * Admin settings control collection and optional retention. PG_STATS_INTERVAL_MS
 * is the interval fallback (100000 ms); PG_STATS_CSV_PATH supplies the path/stem
 * (default logs/pg-performance.csv -> logs/pg-performance-YYYY-MM-DD.csv).
 * snapshot() remains available for on-demand performance tools.
 */
const { createCsvStore } = require('./statsCsv');
const { loadSettings } = require('./statsSettings');
let scheduler = null;

/**
 * Convert an object with possibly string-based numeric fields to integers where
 * appropriate. Non-numeric values are preserved.
 *
 * @private
 * @param {Record<string, any>} row - Raw row object from pg_stat_activity aggregation query
 * @returns {Record<string, (number|any)>} Normalized row with numeric strings parsed
 */
function normalizeCountRow(row) {
	const out = {};
	Object.entries(row).forEach(([k, v]) => {
		const num = parseInt(v, 10);
		out[k] = isNaN(num) ? v : num;
	});
	return out;
}

/**
 * Best-effort snapshot of Sequelize connection pool status.
 *
 * Sequelize uses `sequelize-pool` under the hood; depending on configuration
 * (and replication), `connectionManager.pool` can be a single pool or an
 * object with `read`/`write` pools. Intentionally defensive: never throws and
 * returns `null` when pool metrics are unavailable.
 *
 * @private
 * @param {import('sequelize').Sequelize} sequelizeInstance
 * @returns {object|null}
 */
function getSequelizePoolStats(sequelizeInstance) {
	function readMaybeFn(obj, key) {
		if (!obj) return undefined;
		const v = obj[key];
		if (typeof v === 'function') {
			try {
				return v.call(obj);
			} catch (_) {
				return undefined;
			}
		}
		return v;
	}

	function poolSnapshot(pool) {
		if (!pool) return null;
		const snap = {
			max: readMaybeFn(pool, 'max') ?? readMaybeFn(pool, 'maxSize'),
			min: readMaybeFn(pool, 'min') ?? readMaybeFn(pool, 'minSize'),
			size: readMaybeFn(pool, 'size'),
			available: readMaybeFn(pool, 'available'),
			using: readMaybeFn(pool, 'using'),
			waiting: readMaybeFn(pool, 'waiting')
		};
		// Drop keys that came back undefined to keep logs tidy
		Object.keys(snap).forEach((k) => {
			if (snap[k] === undefined) delete snap[k];
		});
		return Object.keys(snap).length ? snap : null;
	}

	try {
		const cm = sequelizeInstance && sequelizeInstance.connectionManager;
		const pool = cm && cm.pool;
		if (!pool) return null;

		// Replication mode can expose separate read/write pools
		if (pool.read || pool.write) {
			const out = {};
			if (Array.isArray(pool.read)) out.read = pool.read.map(poolSnapshot);
			else if (pool.read) out.read = poolSnapshot(pool.read);

			if (Array.isArray(pool.write)) out.write = pool.write.map(poolSnapshot);
			else if (pool.write) out.write = poolSnapshot(pool.write);

			return Object.keys(out).length ? out : null;
		}

		return poolSnapshot(pool);
	} catch (_) {
		return null;
	}
}

/**
 * Collect one snapshot of PostgreSQL runtime statistics and return it.
 *
 * Shared by the periodic logger (`start`) and on-demand callers such as the
 * perf tool's metric sampler. Captures:
 *  1. Connection state counts (active/idle/total)
 *  2. Sequelize pool status (incl. using/waiting — the pool-exhaustion signal)
 *  3. Oldest active queries ( > 1 second ) capped at 10
 *  4. Database cumulative counters + derived ratios (cache hit %, rollback %, deadlocks)
 *  5. Lock inventory (counts per mode, waiting locks, sample of waiters)
 *
 * Any individual subsection failure is captured in the returned object under
 * the relevant key and does not abort the remaining sections. Never throws.
 *
 * @param {import('sequelize').Sequelize} sequelize - Postgres-dialect Sequelize instance
 * @param {object} [logger] - Optional logger for sub-query error reporting
 * @returns {Promise<Object>} { counts, sequelizePool, oldestActive, dbStats, locks, collectedAt }
 */
async function snapshot(sequelize, logger = null) {
	const result = {
		counts: {},
		sequelizePool: null,
		oldestActive: [],
		dbStats: {},
		locks: { total: 0, waiting: 0, byMode: [], waitingSamples: [] },
		collectedAt: new Date().toISOString()
	};

	// Connection state counts
	try {
		const [countRows] = await sequelize.query(`
			SELECT
				COUNT(*) AS total,
				COUNT(*) FILTER (WHERE state='active') AS active,
				COUNT(*) FILTER (WHERE state='idle') AS idle
			FROM pg_stat_activity;`);
		result.counts = countRows && countRows[0] ? normalizeCountRow(countRows[0]) : {};
	} catch (e) {
		if (logger) logger.error('pg_stat_activity counts query failed: ' + e.message);
	}

	result.sequelizePool = getSequelizePoolStats(sequelize);

	// Oldest active queries (>1s), capped at 10
	try {
		const [oldestRows] = await sequelize.query(`
                SELECT pid, now()-query_start AS age, wait_event_type||':'||COALESCE(wait_event,'') AS wait,
                    COALESCE(backend_type,'') AS backend, left(query,120) AS query
                FROM pg_stat_activity
                WHERE state='active' AND now()-query_start > interval '1 second'
                ORDER BY query_start
                LIMIT 10;`);
		result.oldestActive = oldestRows || [];
	} catch (e) {
		if (logger) logger.error('pg_stat_activity oldest query failed: ' + e.message);
	}

	// DB-level counters (pg_stat_database) for current DB
	try {
		const [dbRows] = await sequelize.query(`
                    SELECT datname,
                           xact_commit,
                           xact_rollback,
                           blks_hit,
                           blks_read,
                           tup_returned,
                           tup_fetched,
                           tup_inserted,
                           tup_updated,
                           tup_deleted,
                           temp_files,
                           temp_bytes,
                           deadlocks,
                           blk_read_time,
                           blk_write_time,
                           CASE WHEN (blks_hit + blks_read) > 0 THEN round( (blks_hit::numeric / (blks_hit + blks_read)) * 100, 2) ELSE NULL END AS cache_hit_pct,
                           CASE WHEN (xact_commit + xact_rollback) > 0 THEN round( (xact_rollback::numeric / (xact_commit + xact_rollback)) * 100, 2) ELSE NULL END AS rollback_pct
                    FROM pg_stat_database
                    WHERE datname = current_database();`);
		if (dbRows && dbRows[0]) {
			const r = dbRows[0];
			result.dbStats = {
				datname: r.datname,
				commits: parseInt(r.xact_commit, 10),
				rollbacks: parseInt(r.xact_rollback, 10),
				rollback_pct: r.rollback_pct !== null ? Number(r.rollback_pct) : null,
				cache_hit_pct: r.cache_hit_pct !== null ? Number(r.cache_hit_pct) : null,
				blks_hit: parseInt(r.blks_hit, 10),
				blks_read: parseInt(r.blks_read, 10),
				tup_returned: parseInt(r.tup_returned, 10),
				tup_fetched: parseInt(r.tup_fetched, 10),
				tup_inserted: parseInt(r.tup_inserted, 10),
				tup_updated: parseInt(r.tup_updated, 10),
				tup_deleted: parseInt(r.tup_deleted, 10),
				deadlocks: parseInt(r.deadlocks, 10),
				temp_files: parseInt(r.temp_files, 10),
				temp_bytes: parseInt(r.temp_bytes, 10),
				blk_read_time: r.blk_read_time !== null ? Number(r.blk_read_time) : null,
				blk_write_time: r.blk_write_time !== null ? Number(r.blk_write_time) : null
			};
		}
	} catch (eDb) {
		if (logger) logger.error('pg_stat_database query failed: ' + eDb.message);
	}

	// Locks summary (pg_locks)
	try {
		const [lockCounts] = await sequelize.query(`
                    SELECT mode, COUNT(*) AS count
                    FROM pg_locks
                    GROUP BY mode
                    ORDER BY count DESC;`);
		const [waitingCountRows] = await sequelize.query(`
                    SELECT COUNT(*) AS waiting
                    FROM pg_locks
                    WHERE NOT granted;`);
		const waitingCount = waitingCountRows && waitingCountRows[0] ? parseInt(waitingCountRows[0].waiting, 10) : 0;
		let waitingSamples = [];
		if (waitingCount > 0) {
			const [waitingDetails] = await sequelize.query(`
                        SELECT pid, locktype, mode, relation::regclass AS relation,
                               virtualxid, virtualtransaction, transactionid,
                               granted
                        FROM pg_locks
                        WHERE NOT granted
                        LIMIT 10;`);
			waitingSamples = waitingDetails || [];
		}
		result.locks = {
			total: lockCounts ? lockCounts.reduce((a, c) => a + parseInt(c.count, 10), 0) : 0,
			waiting: waitingCount,
			byMode: (lockCounts || []).map(r => ({ mode: r.mode, count: parseInt(r.count, 10) })),
			waitingSamples
		};
	} catch (eL) {
		if (logger) logger.error('pg_locks query failed: ' + eL.message);
	}

	return result;
}

/**
 * Start statistics collection once and apply saved admin settings.
 * Later committed settings changes can be applied with refresh().
 *
 * @param {import('sequelize').Sequelize} sequelize - PostgreSQL connection and settings models
 * @param {object} logger - Logger with an error method for collection and cleanup failures
 * @param {object} [options={}] - Scheduler options
 * @param {number} [options.intervalMs=100000] - Fallback interval, overridden by PG_STATS_INTERVAL_MS
 * @returns {Promise<void>|undefined} Initial collection completion, or undefined if already started
 */
function start(sequelize, logger, options = {}) {
	if (scheduler) return;
	const requested = Number(process.env.PG_STATS_INTERVAL_MS || options.intervalMs || 100000);
	const fallback = Number.isInteger(requested) && requested > 0 && requested <= 2147483647 ? requested : 100000;
	const state = {
		sequelize, logger, fallback, timer: null, cleanupTimer: null, collecting: null,
		config: { intervalMs: fallback, autoDelete: false, retentionDays: 30 },
		store: createCsvStore(process.env.PG_STATS_CSV_PATH || 'logs/pg-performance.csv'),
		refreshQueue: Promise.resolve(),
	};
	scheduler = state;
	state.collect = () => {
		if (scheduler !== state || state.collecting) return;
		state.collecting = (async () => {
			try {
				const intervalMs = state.config.intervalMs;
				const snap = await snapshot(sequelize, logger);
				await state.store.write(snap, intervalMs);
			} catch (error) {
				logger.error('pg_stat_activity scheduler error: ' + error.message);
			}
		})().finally(() => { state.collecting = null; });
		return state.collecting;
	};
	state.cleanup = () => state.store.cleanup(state.config, logger).catch(error => {
		logger.error('pg_stats cleanup error: ' + error.message);
	});
	const scheduleCleanup = () => {
		const now = Date.now();
		const nextMidnight = Math.floor(now / 86400000) * 86400000 + 86400000;
		state.cleanupTimer = setTimeout(async () => {
			await state.cleanup();
			if (scheduler === state) scheduleCleanup();
		}, nextMidnight - now);
	};
	scheduleCleanup();
	return refresh().then(() => state.collect());
}

/**
 * Reload settings after their transaction commits and reschedule collection.
 * Read failures keep collection running and disable automatic deletion.
 *
 * @returns {Promise<void>} Completion of the queued settings refresh and cleanup
 */
function refresh() {
	const state = scheduler;
	if (!state) return Promise.resolve();
	state.refreshQueue = state.refreshQueue.then(async () => {
		try {
			const config = await loadSettings(state.sequelize, state.fallback);
			if (scheduler !== state) return;
			Object.assign(state.config, config);
		} catch (error) {
			state.logger.error('pg_stats settings error: ' + error.message);
			// Fail closed: a settings read failure must never enable deletion.
			state.config.autoDelete = false;
		}
		if (scheduler !== state) return;
		clearInterval(state.timer);
		state.timer = setInterval(state.collect, state.config.intervalMs);
		await state.cleanup();
	});
	return state.refreshQueue;
}

/**
 * Stop scheduling and wait for the current collection and queued file operations.
 *
 * @returns {Promise<void>} Completion of scheduler shutdown and pending file operations
 */
async function stop() {
	const state = scheduler;
	if (!state) return;
	scheduler = null;
	state.config.autoDelete = false;
	clearInterval(state.timer);
	clearTimeout(state.cleanupTimer);
	await state.refreshQueue;
	await state.collecting;
	await state.store.drain();
}

module.exports = { start, stop, snapshot, refresh };
