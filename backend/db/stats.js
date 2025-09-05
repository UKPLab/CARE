/**
 * Periodic PostgreSQL activity statistics logger.
 *
 * Runs the two provided pg_stat_activity queries on an interval and logs
 * the aggregated counts and a shortlist of the oldest active queries.
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
 *     intervalMs: <interval>,
 *     collectedAt: <ISO timestamp>
 *   }
 */

let _timer = null;

/**
 * Start the periodic PostgreSQL statistics scheduler.
 *
 * Creates an interval that periodically captures:
 *  - Connection state counts (pg_stat_activity)
 *  - Oldest active queries (>1s)
 *  - Database-level counters (pg_stat_database) for current DB
 *  - Lock summary (pg_locks)
 *
 * Results are emitted via logger.info with message 'pg_stat_activity snapshot'.
 * Multiple concurrent invocations are ignored (idempotent start).
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
	 * Collect one snapshot of PostgreSQL runtime statistics and emit via logger.
	 *
	 * Steps:
	 *  1. Connection state counts (active/idle/total)
	 *  2. Oldest active queries ( > 1 second ) capped at 10
	 *  3. Database cumulative counters + derived ratios (cache hit %, rollback %)
	 *  4. Lock inventory (counts per mode, waiting locks, sample of waiters)
	 *
	 * Any individual subsection failure is logged (warn/error) but does not abort remaining sections.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	async function collect() {
		try {
			// First query: counts
			const [countRows] = await sequelize.query(`
				SELECT
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE state='active') AS active,
					COUNT(*) FILTER (WHERE state='idle') AS idle
				FROM pg_stat_activity;`);
			const counts = countRows && countRows[0] ? normalizeCountRow(countRows[0]) : {};
			// Second query: EXACT user requested static query (1s min age, LIMIT 10)
			const [oldestRows] = await sequelize.query(`
                SELECT pid, now()-query_start AS age, wait_event_type||':'||COALESCE(wait_event,'') AS wait,
                    COALESCE(backend_type,'') AS backend, left(query,120) AS query
                FROM pg_stat_activity
                WHERE state='active' AND now()-query_start > interval '1 second'
                ORDER BY query_start
                LIMIT 10;`);

			// DB-level counters (pg_stat_database) for current DB
			let dbStats = {};
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
					dbStats = {
						datname: r.datname,
						commits: parseInt(r.xact_commit,10),
						rollbacks: parseInt(r.xact_rollback,10),
						rollback_pct: r.rollback_pct !== null ? Number(r.rollback_pct) : null,
						cache_hit_pct: r.cache_hit_pct !== null ? Number(r.cache_hit_pct) : null,
						blks_hit: parseInt(r.blks_hit,10),
						blks_read: parseInt(r.blks_read,10),
						tup_returned: parseInt(r.tup_returned,10),
						tup_fetched: parseInt(r.tup_fetched,10),
						tup_inserted: parseInt(r.tup_inserted,10),
						tup_updated: parseInt(r.tup_updated,10),
						tup_deleted: parseInt(r.tup_deleted,10),
						deadlocks: parseInt(r.deadlocks,10),
						temp_files: parseInt(r.temp_files,10),
						temp_bytes: parseInt(r.temp_bytes,10),
						blk_read_time: r.blk_read_time !== null ? Number(r.blk_read_time) : null,
						blk_write_time: r.blk_write_time !== null ? Number(r.blk_write_time) : null
					};
				}
			} catch (eDb) {
				logger.error('pg_stat_database query failed: ' + eDb.message);
			}

			// Locks summary (pg_locks)
			let locks = { total: 0, waiting: 0, byMode: [], waitingSamples: [] };
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
				const waitingCount = waitingCountRows && waitingCountRows[0] ? parseInt(waitingCountRows[0].waiting,10) : 0;
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
				locks = {
					total: lockCounts ? lockCounts.reduce((a,c)=> a + parseInt(c.count,10), 0) : 0,
					waiting: waitingCount,
					byMode: (lockCounts || []).map(r => ({ mode: r.mode, count: parseInt(r.count,10) })),
					waitingSamples
				};
			} catch (eL) {
				logger.error('pg_locks query failed: ' + eL.message);
			}

			logger.info('pg_stat_activity snapshot', {
				pg_stat_activity: {
					counts,
					oldestActive: oldestRows || [],
					dbStats,
					locks,
					collectedAt: new Date().toISOString()
				}
			});
		} catch (e) {
			logger.error('pg_stat_activity scheduler error: ' + e.message);
		}
	}

	// Normalize returned numeric strings to integers
	/**
	 * Convert object with possibly string-based numeric fields to integers where appropriate.
	 * Non-numeric values are preserved.
	 *
	 * @private
	 * @param {Record<string, any>} row - Raw row object from pg_stat_activity aggregation query
	 * @returns {Record<string, (number|any)>} Normalized row with numeric strings parsed
	 */
	function normalizeCountRow(row) {
		const out = {};
		Object.entries(row).forEach(([k,v]) => {
			const num = parseInt(v, 10);
			out[k] = isNaN(num) ? v : num;
		});
		return out;
	}

	// Kick off immediately then schedule
	collect();
	_timer = setInterval(collect, intervalMs);
	logger.debug(`Started pg_stat_activity scheduler (interval ${intervalMs} ms, minAge ${minAgeMs} ms, topN ${topN}).`);
}

function stop(logger) {
	/**
	 * Stop the running statistics scheduler interval if active.
	 * Safe to call multiple times.
	 *
	 * @param {object} [logger] - Logger for optional debug message
	 * @returns {void}
	 */
	if (_timer) {
		clearInterval(_timer);
		_timer = null;
		if (logger) logger.debug('Stopped pg_stat_activity scheduler.');
	}
}

module.exports = { start, stop };

