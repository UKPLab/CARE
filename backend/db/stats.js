/**
 * Periodic PostgreSQL activity statistics logger.
 *
 * Runs the pg_stat_activity / pg_stat_database / pg_locks queries on an interval
 * and logs the aggregated counts and a shortlist of the oldest active queries.
 * The same snapshot logic is exposed as `snapshot()` for on-demand callers
 * (e.g. the perf load-testing tool).
 *
 * Configuration (env):
 *   PG_STATS_INTERVAL_MS  Interval in ms (default 60000)
 *   PG_STATS_MIN_AGE_MS   Minimum query age in ms for second query (default 1000)
 *   PG_STATS_TOP_N        How many oldest active queries to list (default 10)
 *
 * The log entry structure (level=info) is:
 *   message: "pg_stat_activity snapshot"
 *   pg_stat_activity: {
 *     counts: { total, active, idle },
 *     oldestActive: [ { pid, age_ms, wait, backend, query }... ],
 *     sequelizePool: { max, min, size, available, using, waiting } | { write, read } | null,
 *     intervalMs: <interval>,
 *     collectedAt: <ISO timestamp>
 *   }
 */

let _timer = null;

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
 * Start the periodic PostgreSQL statistics scheduler.
 *
 * Creates an interval that periodically captures a `snapshot()` and emits it via
 * logger.info with message 'pg_stat_activity snapshot'. Multiple concurrent
 * invocations are ignored (idempotent start).
 *
 * @param {import('sequelize').Sequelize} sequelize - Initialized Sequelize instance (must be Postgres dialect)
 * @param {object} logger - Winston logger instance (child acceptable) used for output
 * @param {object} [options] - Optional overrides
 * @param {number} [options.intervalMs] - Override collection interval in ms (default env PG_STATS_INTERVAL_MS or 100000)
 * @param {number} [options.minAgeMs] - (Currently unused after fixed 1s query; retained for compatibility)
 * @param {number} [options.topN] - (Currently unused after fixed LIMIT 10; retained for compatibility)
 * @returns {void}
 */
function start(sequelize, logger, options = {}) {
	if (_timer) return; // already running
	const intervalMs = parseInt(process.env.PG_STATS_INTERVAL_MS || options.intervalMs || '100000', 10);
	const minAgeMs = parseInt(process.env.PG_STATS_MIN_AGE_MS || options.minAgeMs || '10000', 10);
	const topN = parseInt(process.env.PG_STATS_TOP_N || options.topN || '10', 10);

	/**
	 * Collect one snapshot and emit it via the logger. Never throws.
	 * @private
	 * @returns {Promise<void>}
	 */
	async function collect() {
		try {
			const snap = await snapshot(sequelize, logger);
			logger.info('pg_stat_activity snapshot', {
				pg_stat_activity: {
					counts: snap.counts,
					oldestActive: snap.oldestActive,
					sequelizePool: snap.sequelizePool,
					dbStats: snap.dbStats,
					locks: snap.locks,
					intervalMs,
					collectedAt: snap.collectedAt
				}
			});
		} catch (e) {
			logger.error('pg_stat_activity scheduler error: ' + e.message);
		}
	}

	// Kick off immediately then schedule
	collect();
	_timer = setInterval(collect, intervalMs);
	logger.debug(`Started pg_stat_activity scheduler (interval ${intervalMs} ms, minAge ${minAgeMs} ms, topN ${topN}).`);
}

/**
 * Stop the running statistics scheduler interval if active. Safe to call
 * multiple times.
 *
 * @param {object} [logger] - Logger for optional debug message
 * @returns {void}
 */
function stop(logger) {
	if (_timer) {
		clearInterval(_timer);
		_timer = null;
		if (logger) logger.debug('Stopped pg_stat_activity scheduler.');
	}
}

/**
 * Aggregate counters of the current database only. Unlike snapshot() it reads no
 * query text, client addresses, process ids, user or database names, and does not
 * look at other databases on the same server.
 *
 * @private
 */
const CURRENT_DATABASE_HEALTH_QUERY = `
	WITH activity AS (
		SELECT pid, state, wait_event_type, query_start, xact_start
		FROM pg_stat_activity
		WHERE datname = current_database() AND pid <> pg_backend_pid()
	), locks AS (
		SELECT l.mode, l.granted
		FROM pg_locks l
		JOIN activity a ON a.pid = l.pid
	)
	SELECT
		(SELECT COUNT(*) FROM activity) AS connections_total,
		(SELECT COUNT(*) FROM activity WHERE state = 'active') AS connections_active,
		(SELECT COUNT(*) FROM activity WHERE state = 'idle') AS connections_idle,
		(SELECT COUNT(*) FROM activity WHERE state LIKE 'idle in transaction%') AS connections_idle_in_transaction,
		(SELECT COUNT(*) FROM activity WHERE wait_event_type = 'Lock') AS connections_waiting_on_lock,
		(SELECT COALESCE(ROUND(EXTRACT(EPOCH FROM MAX(now() - query_start)) * 1000), 0) FROM activity WHERE state = 'active') AS longest_active_query_ms,
		(SELECT COALESCE(ROUND(EXTRACT(EPOCH FROM MAX(now() - xact_start)) * 1000), 0) FROM activity) AS longest_transaction_ms,
		(SELECT COUNT(*) FROM locks) AS locks_total,
		(SELECT COUNT(*) FROM locks WHERE NOT granted) AS locks_waiting,
		(SELECT COALESCE(json_object_agg(mode, n), '{}'::json) FROM (SELECT mode, COUNT(*) AS n FROM locks GROUP BY mode) m) AS locks_by_mode,
		d.xact_commit, d.xact_rollback, d.blks_hit, d.blks_read, d.deadlocks, d.conflicts, d.temp_files, d.temp_bytes, d.stats_reset
	FROM pg_stat_database d
	WHERE d.datname = current_database();`;

const POOL_FIELDS = ['max', 'min', 'size', 'available', 'using', 'waiting'];
const LOCK_MODE_PATTERN = /^[A-Za-z]{1,40}Lock$/;

/**
 * @private
 * @param {*} value Count from PostgreSQL (bigint values arrive as strings)
 * @returns {number|null}
 */
function toCount(value) {
	const number = Number(value);
	return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

/**
 * @private
 * @param {*} pool Output of getSequelizePoolStats for one pool
 * @returns {Object|null} Numeric pool fields only
 */
function numericPool(pool) {
	if (!pool || typeof pool !== 'object') return null;
	const out = {};
	POOL_FIELDS.forEach((field) => {
		if (Number.isFinite(pool[field])) out[field] = pool[field];
	});
	return Object.keys(out).length ? out : null;
}

/**
 * Sequelize pool usage with numeric fields only (replication pools are reduced to their first pool).
 *
 * @private
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Object|null}
 */
function poolUsage(sequelize) {
	const pool = getSequelizePoolStats(sequelize);
	if (pool && (pool.read || pool.write)) {
		const first = (value) => numericPool(Array.isArray(value) ? value[0] : value);
		return {read: first(pool.read), write: first(pool.write)};
	}
	return numericPool(pool);
}

/**
 * @private
 * @param {Object} row Row of CURRENT_DATABASE_HEALTH_QUERY
 * @returns {Object} Health counters
 */
function healthFromRow(row) {
	const commits = toCount(row.xact_commit);
	const rollbacks = toCount(row.xact_rollback);
	const hit = toCount(row.blks_hit);
	const read = toCount(row.blks_read);
	const percent = (part, total) => (total > 0 ? Math.round((part / total) * 10000) / 100 : null);
	const byMode = {};
	Object.entries(row.locks_by_mode && typeof row.locks_by_mode === 'object' ? row.locks_by_mode : {})
		.filter(([mode]) => LOCK_MODE_PATTERN.test(mode))
		.forEach(([mode, count]) => {
			byMode[mode] = toCount(count);
		});
	const statsReset = row.stats_reset ? new Date(row.stats_reset) : null;
	return {
		connections: {
			total: toCount(row.connections_total),
			active: toCount(row.connections_active),
			idle: toCount(row.connections_idle),
			idleInTransaction: toCount(row.connections_idle_in_transaction),
			waitingOnLock: toCount(row.connections_waiting_on_lock),
		},
		longestActiveQueryMs: toCount(row.longest_active_query_ms),
		longestTransactionMs: toCount(row.longest_transaction_ms),
		locks: {total: toCount(row.locks_total), waiting: toCount(row.locks_waiting), byMode},
		transactions: {
			commits,
			rollbacks,
			rollbackPct: commits !== null && rollbacks !== null ? percent(rollbacks, commits + rollbacks) : null,
		},
		cache: {
			blocksHit: hit,
			blocksRead: read,
			hitPct: hit !== null && read !== null ? percent(hit, hit + read) : null,
		},
		deadlocks: toCount(row.deadlocks),
		conflicts: toCount(row.conflicts),
		tempFiles: toCount(row.temp_files),
		tempBytes: toCount(row.temp_bytes),
		countersSince: statsReset && !Number.isNaN(statsReset.getTime()) ? statsReset.toISOString() : null,
	};
}

/**
 * Best-effort health snapshot of the current CARE database for problem reports.
 *
 * Returns only aggregate numbers (see CURRENT_DATABASE_HEALTH_QUERY) and the
 * Sequelize pool usage, which is read from memory and is therefore included even
 * when the database does not answer (an exhausted pool is a typical reason).
 * The query runs with a statement timeout and the call resolves within
 * about timeoutMs. Never throws and never returns database error messages.
 *
 * @param {import('sequelize').Sequelize} sequelize - Postgres-dialect Sequelize instance
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=2000] - Upper bound for the query in ms
 * @param {object} [options.logger] - Logger for failures (logs the error code only)
 * @returns {Promise<Object>} { status: "ok"|"unavailable", reason?, capturedAt, pool, ...counters }
 */
async function currentDatabaseHealth(sequelize, { timeoutMs = 2000, logger = null } = {}) {
	const capturedAt = new Date().toISOString();
	const timeout = Math.max(1, Math.floor(timeoutMs));
	let timer = null;
	const query = sequelize.transaction(async (transaction) => {
		await sequelize.query("SELECT set_config('statement_timeout', :timeout, true)", {
			replacements: { timeout: String(timeout) },
			transaction,
		});
		const [rows] = await sequelize.query(CURRENT_DATABASE_HEALTH_QUERY, { transaction });
		return rows && rows[0];
	});
	const timedOut = new Promise((resolve) => {
		timer = setTimeout(() => resolve('timeout'), timeout + 250);
	});
	try {
		const row = await Promise.race([query, timedOut]);
		if (row === 'timeout') {
			// The query keeps its own statement timeout; ignore its late result
			query.catch(() => {});
			return { status: 'unavailable', reason: 'timeout', capturedAt, pool: poolUsage(sequelize) };
		}
		if (!row) {
			return { status: 'unavailable', reason: 'error', capturedAt, pool: poolUsage(sequelize) };
		}
		return { status: 'ok', capturedAt, pool: poolUsage(sequelize), ...healthFromRow(row) };
	} catch (e) {
		// '57014' is PostgreSQL's query_canceled (statement timeout)
		const code = e && (e.original?.code || e.parent?.code || e.code);
		if (logger) logger.warn(`Database health snapshot failed (code ${typeof code === 'string' ? code.slice(0, 10) : 'unknown'})`);
		return { status: 'unavailable', reason: code === '57014' ? 'timeout' : 'error', capturedAt, pool: poolUsage(sequelize) };
	} finally {
		clearTimeout(timer);
	}
}

module.exports = { start, stop, snapshot, currentDatabaseHealth };