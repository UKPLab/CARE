"use strict";

// Transaction control statements only; every data query is a SELECT. PostgreSQL's
// timeout cancels work on the server, unlike Promise.race which leaves it running.
async function readOnlyQuery(sequelize, sql, timeoutMs = 2000, replacements = {}) {
    const timeout = Math.min(10000, Math.max(100, Number(timeoutMs) || 2000));
    return sequelize.transaction({readOnly: true}, async transaction => {
        await sequelize.query('SET TRANSACTION READ ONLY', {transaction});
        await sequelize.query(`SET LOCAL statement_timeout = ${Math.floor(timeout)}`, {transaction});
        await sequelize.query(`SET LOCAL lock_timeout = ${Math.floor(timeout)}`, {transaction});
        return sequelize.query(sql, {transaction, replacements, type: 'SELECT'});
    });
}

async function currentDatabaseHealth(sequelize, timeoutMs) {
    const rows = await readOnlyQuery(sequelize, `SELECT current_database() AS database, pg_postmaster_start_time() AS "startedAt", current_setting('server_version') AS version,
        extract(epoch FROM clock_timestamp()-pg_postmaster_start_time())::float8 AS "uptimeSeconds",
        pg_database_size(current_database())::float8 AS "sizeBytes",
        age(datfrozenxid)::float8 AS "wraparoundAge"
        FROM pg_database WHERE datname=current_database()`, timeoutMs);
    return rows[0];
}
module.exports = {readOnlyQuery, currentDatabaseHealth};
