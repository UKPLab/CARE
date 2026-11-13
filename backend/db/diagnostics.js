"use strict";
const fs = require('fs');
const path = require('path');
const {readOnlyQuery, currentDatabaseHealth} = require('./health');
const {getSequelizePoolStats} = require('./stats');
const defaults = Object.freeze({queryTimeoutMs:2000, autoRefreshSeconds:30, connectionWarningPct:80, connectionCriticalPct:95,
    queryWarningSeconds:30, queryCriticalSeconds:120, cacheWarningPct:95, cacheCriticalPct:90,
    rollbackWarningPct:5, rollbackCriticalPct:20, wraparoundWarningAge:150000000, wraparoundCriticalAge:180000000});
const queries = {
    connections: `SELECT count(*)::int AS used, current_setting('max_connections')::int AS max,
        count(*) FILTER (WHERE state='active')::int AS active,
        count(*) FILTER (WHERE state='idle')::int AS idle,
        count(*) FILTER (WHERE state='idle in transaction')::int AS "idleInTransaction"
        FROM pg_stat_activity WHERE datname=current_database()`,
    queries: `SELECT pid, extract(epoch FROM clock_timestamp()-query_start)::float8 AS "ageSeconds",
        left(regexp_replace(query, $redact$'([^']|'')*('|$)$redact$, $redact$'?'$redact$, 'g'),120) AS query, wait_event_type AS "waitEventType", wait_event AS "waitEvent",
        ARRAY(SELECT b.pid FROM pg_stat_activity b WHERE b.datname=current_database()
            AND b.pid=ANY(pg_blocking_pids(a.pid))) AS blockers
        FROM pg_stat_activity a WHERE datname=current_database() AND pid<>pg_backend_pid()
            AND (state='active' OR cardinality(pg_blocking_pids(pid))>0)
        ORDER BY query_start LIMIT 10`,
    efficiency: `SELECT 100.0*blks_hit/NULLIF(blks_hit+blks_read,0) AS "cacheHitPct",
        100.0*xact_rollback/NULLIF(xact_commit+xact_rollback,0) AS "rollbackPct",
        stats_reset AS "statsResetAt", deadlocks::float8, temp_files::float8 AS "tempFiles", temp_bytes::float8 AS "tempBytes"
        FROM pg_stat_database WHERE datname=current_database()`,
    storage: `SELECT schemaname AS schema, relname AS table, n_live_tup::float8 AS rows,
        n_dead_tup::float8 AS "deadRows", pg_total_relation_size(relid)::float8 AS "sizeBytes"
        FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC`,
    maintenance: `SELECT t.schemaname AS schema,t.relname AS table,last_vacuum AS "lastVacuum",
        last_autovacuum AS "lastAutovacuum",last_analyze AS "lastAnalyze",last_autoanalyze AS "lastAutoanalyze",
        age(c.relfrozenxid)::float8 AS "wraparoundAge",
        COALESCE((SELECT json_agg(json_build_object('index',i.indexrelname,'sizeBytes',pg_relation_size(i.indexrelid)))
            FROM pg_stat_user_indexes i JOIN pg_index ix ON ix.indexrelid=i.indexrelid
            WHERE i.relid=t.relid AND i.idx_scan=0 AND NOT ix.indisunique AND NOT ix.indisprimary),'[]') AS "unusedIndexes"
        FROM pg_stat_user_tables t JOIN pg_class c ON c.oid=t.relid ORDER BY age(c.relfrozenxid) DESC`,
    migrations: 'SELECT name FROM "SequelizeMeta" ORDER BY name',
};
function statusFor(sections, thresholds=defaults) {
    let severity = Object.values(sections).some(s => !s.available) ? 1 : 0;
    const check = (value, warning, critical, low=false) => {
        if (value == null || !Number.isFinite(Number(value))) return;
        const n=Number(value);
        if (low ? n<=critical : n>=critical) severity=2;
        else if (low ? n<=warning : n>=warning) severity=Math.max(severity,1);
    };
    const c=sections.connections?.data;
    if(c?.max>0) check(c.used/c.max*100,thresholds.connectionWarningPct,thresholds.connectionCriticalPct);
    for(const q of sections.queries?.data || []) check(q.ageSeconds,thresholds.queryWarningSeconds,thresholds.queryCriticalSeconds);
    const e=sections.efficiency?.data;
    check(e?.cacheHitPct,thresholds.cacheWarningPct,thresholds.cacheCriticalPct,true);
    check(e?.rollbackPct,thresholds.rollbackWarningPct,thresholds.rollbackCriticalPct);
    check(sections.database?.data?.wraparoundAge,thresholds.wraparoundWarningAge,thresholds.wraparoundCriticalAge);
    for(const t of sections.maintenance?.data || []) check(t.wraparoundAge,thresholds.wraparoundWarningAge,thresholds.wraparoundCriticalAge);
    return ['OK','Warning','Critical'][severity];
}
async function collectDiagnostics(sequelize) {
    const sections={};
    const thresholds={...defaults};
    const section = async (name, fn) => {
        try { sections[name]={available:true,data:await fn()}; }
        catch (_) { sections[name]={available:false,reason:'unavailable'}; }
    };
    await section('settings',async()=>{
        const rows=await readOnlyQuery(sequelize,"SELECT key,value FROM setting WHERE key LIKE 'diagnostics.%' AND deleted=false");
        for(const row of rows) {
            const key=row.key.slice('diagnostics.'.length), value=Number(row.value);
            if(Object.hasOwn(defaults,key) && row.value!=='' && Number.isFinite(value) && value>0) thresholds[key]=value;
        }
        thresholds.queryTimeoutMs=Math.min(10000,Math.max(100,thresholds.queryTimeoutMs));
        for(const prefix of ['connection','query','rollback','wraparound']) {
            const suffix={connection:'Pct',query:'Seconds',rollback:'Pct',wraparound:'Age'}[prefix];
            if(thresholds[prefix+'Warning'+suffix]>thresholds[prefix+'Critical'+suffix]) {
                thresholds[prefix+'Warning'+suffix]=defaults[prefix+'Warning'+suffix];
                thresholds[prefix+'Critical'+suffix]=defaults[prefix+'Critical'+suffix];
            }
        }
        if(thresholds.cacheWarningPct<thresholds.cacheCriticalPct) {
            thresholds.cacheWarningPct=defaults.cacheWarningPct; thresholds.cacheCriticalPct=defaults.cacheCriticalPct;
        }
        return null;
    });
    await section('database',()=>currentDatabaseHealth(sequelize,thresholds.queryTimeoutMs));
    // Sequential acquisition avoids exhausting the application pool on refresh.
    for(const [name,sql] of Object.entries(queries)) await section(name,async()=>{
        const rows=await readOnlyQuery(sequelize,sql,thresholds.queryTimeoutMs);
        if(name==='connections') return {...rows[0],pool:getSequelizePoolStats(sequelize)};
        if(name==='efficiency') return rows[0];
        if(name==='queries') {
            const counts=await readOnlyQuery(sequelize,"SELECT count(*)::int AS waiting FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database() AND NOT l.granted",thresholds.queryTimeoutMs);
            const safeRows=rows.map(row=>({...row,query:row.query?.replace(/'(?:''|[^'])*(?:'|$)/g,"'?'").replace(/\b\d+\b/g,'?').slice(0,120)}));
            safeRows.waitingLocks=counts[0]?.waiting ?? 0;
            return safeRows;
        }
        if(name==='migrations') {
            const applied=new Set(rows.map(r=>r.name));
            return {lastApplied:rows.at(-1)?.name || null,appliedCount:rows.length,pending:fs.readdirSync(path.join(__dirname,'migrations')).filter(f=>f.endsWith('.js')&&!applied.has(f)).sort()};
        }
        return rows;
    });
    const status=statusFor(sections,thresholds);
    for(const [name,s] of Object.entries(sections)) s.status=statusFor({[name]:s},thresholds).toLowerCase();
    delete sections.settings;
    return presentSnapshot(sections,status,thresholds);
}
// Match the dashboard contract while keeping catalog collection independent of presentation.
function presentSnapshot(sections,status,thresholds) {
    const data = key => sections[key]?.available ? sections[key].data : null;
    const database=data('database');
    sections.server=sections.database;
    delete sections.database;
    if(data('connections')) {
        const c=data('connections'); c.usedPct=c.max>0 ? c.used/c.max*100 : null;
    }
    if(data('queries')) {
        const rows=data('queries');
        sections.queries.data={longest:rows.map(q=>({...q,durationMs:q.ageSeconds*1000})),
            waitingLocks:rows.waitingLocks,
            blocking:rows.flatMap(q=>q.blockers.map(pid=>({blockedPid:q.pid,blockingPid:pid,waitingMs:q.ageSeconds*1000})))};
    }
    if(data('storage')) sections.storage.data={databaseBytes:database?.sizeBytes ?? null,
        tables:data('storage').map(t=>({...t,name:t.table,totalBytes:t.sizeBytes,
            deadPct:t.rows+t.deadRows>0 ? 100*t.deadRows/(t.rows+t.deadRows) : null}))};
    if(data('maintenance')) {
        const tables=data('maintenance');
        const latest=(a,b)=> !a ? b : !b ? a : new Date(a)>new Date(b) ? a : b;
        sections.maintenance.data={wraparound:{age:database?.wraparoundAge ?? null,
            pct:database ? database.wraparoundAge/2147483647*100 : null},
            tables:tables.map(t=>({...t,name:t.table,lastVacuum:latest(t.lastVacuum,t.lastAutovacuum),lastAnalyze:latest(t.lastAnalyze,t.lastAutoanalyze)})),
            unusedIndexes:tables.flatMap(t=>t.unusedIndexes.map(i=>({...i,table:t.table})))};
    }
    if(data('migrations')) { const m=data('migrations'); m.last=m.lastApplied ? {name:m.lastApplied} : null; }
    return {collectedAt:new Date().toISOString(),status:status.toLowerCase(),autoRefreshSeconds:Math.max(10,thresholds.autoRefreshSeconds),thresholds,sections};
}
module.exports={collectDiagnostics,statusFor,defaults,queries};
