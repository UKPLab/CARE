/**
 * Tests for the Diagnostics dashboard contract helpers (#526).
 *
 * The payload below mirrors what backend/db/diagnostics.js returns: lowercase
 * statuses, `thresholds`, unavailable sections with `reason`, no per-metric checks.
 *
 * Run from `frontend`: npm run test:unit
 */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
    DEFAULT_AUTO_REFRESH_SECONDS,
    MIN_AUTO_REFRESH_SECONDS,
    formatBytes,
    formatDuration,
    formatPercent,
    isHighlightedTable,
    levelFor,
    normalizeSnapshot,
    requestTimeoutMs,
    worstStatus,
} from '../src/components/dashboard/diagnostics/diagnostics.js'

const thresholds = {
    queryTimeoutMs: 2000,
    autoRefreshSeconds: 30,
    connectionWarningPct: 80,
    connectionCriticalPct: 95,
    queryWarningSeconds: 30,
    queryCriticalSeconds: 120,
    cacheWarningPct: 95,
    cacheCriticalPct: 90,
    rollbackWarningPct: 5,
    rollbackCriticalPct: 20,
    wraparoundWarningAge: 150000000,
    wraparoundCriticalAge: 180000000,
}

function backendPayload() {
    return {
        collectedAt: '2026-11-13T10:00:00.000Z',
        status: 'warning',
        autoRefreshSeconds: 30,
        thresholds,
        sections: {
            server: {available: true, status: 'ok', data: {version: '16.4', database: 'care', uptimeSeconds: 90061, wraparoundAge: 1000}},
            connections: {available: true, status: 'warning', data: {used: 85, max: 100, usedPct: 85, active: 3, idle: 80, idleInTransaction: 2, pool: null}},
            queries: {available: false, reason: 'unavailable', status: 'warning'},
            efficiency: {available: true, status: 'ok', data: {cacheHitPct: '99.12', rollbackPct: '0.5', deadlocks: 0, tempFiles: 0, tempBytes: 0}},
            storage: {available: true, status: 'ok', data: {databaseBytes: 1048576, tables: [{name: 'log'}, {name: 'user'}]}},
            maintenance: {available: true, status: 'ok', data: {wraparound: {age: 160000000, pct: 7.45}, tables: [], unusedIndexes: []}},
            migrations: {available: true, status: 'ok', data: {last: {name: 'a.js'}, appliedCount: 1, pending: []}},
        },
    }
}

test('normalizes the backend payload and keeps unavailable sections isolated', () => {
    const snapshot = normalizeSnapshot(backendPayload())
    assert.equal(snapshot.status, 'warning')
    assert.equal(snapshot.queryTimeoutMs, 2000)
    assert.equal(snapshot.sections.queries.available, false)
    assert.equal(snapshot.sections.queries.status, 'unknown')
    assert.deepEqual(snapshot.sections.queries.checks, {})
    assert.equal(snapshot.sections.connections.available, true)
    assert.equal(snapshot.sections.migrations.data.last.name, 'a.js')
})

test('derives missing per-metric checks from the backend thresholds', () => {
    const {sections} = normalizeSnapshot(backendPayload())
    assert.equal(sections.connections.checks.usedPct, 'warning')
    assert.equal(sections.efficiency.checks.cacheHitPct, 'ok')
    assert.equal(sections.efficiency.checks.rollbackPct, 'ok')
    assert.equal(sections.maintenance.checks.wraparoundPct, 'warning')
    assert.equal('longestQuery' in sections.queries.checks, false)
})

test('backend checks win over derived ones', () => {
    const payload = backendPayload()
    payload.sections.connections.checks = {usedPct: 'critical'}
    assert.equal(normalizeSnapshot(payload).sections.connections.checks.usedPct, 'critical')
})

test('missing or malformed sections become unavailable instead of throwing', () => {
    const snapshot = normalizeSnapshot({sections: {server: 'oops'}})
    for (const section of Object.values(snapshot.sections)) assert.equal(section.available, false)
    assert.equal(snapshot.status, 'unknown')
    assert.equal(snapshot.autoRefreshSeconds, DEFAULT_AUTO_REFRESH_SECONDS)
    assert.equal(normalizeSnapshot(null).sections.storage.available, false)
})

test('overall status falls back to the worst section and refresh has a floor', () => {
    const payload = backendPayload()
    delete payload.status
    payload.sections.storage.status = 'critical'
    payload.autoRefreshSeconds = 1
    const snapshot = normalizeSnapshot(payload)
    assert.equal(snapshot.status, 'critical')
    assert.equal(snapshot.autoRefreshSeconds, MIN_AUTO_REFRESH_SECONDS)
    assert.equal(worstStatus(['ok', undefined, 'warning']), 'warning')
})

test('levelFor matches inclusive backend bounds, including lower-is-worse', () => {
    assert.equal(levelFor(80, 80, 95), 'warning')
    assert.equal(levelFor(95, 80, 95), 'critical')
    assert.equal(levelFor(79.9, 80, 95), 'ok')
    assert.equal(levelFor(95, 95, 90, true), 'warning')
    assert.equal(levelFor(90, 95, 90, true), 'critical')
    assert.equal(levelFor(null, 80, 95), undefined)
})

test('request timeout covers every sequential query timeout', () => {
    assert.ok(requestTimeoutMs(2000) >= 9 * 2000)
    assert.ok(requestTimeoutMs() >= 9 * 10000)
    assert.equal(requestTimeoutMs(60000), requestTimeoutMs(10000))
})

test('formatters handle numeric strings, missing values and units', () => {
    assert.equal(formatPercent('99.5', 'en', 1), '99.5%')
    assert.equal(formatPercent(null, 'en'), '-')
    assert.equal(formatBytes(1048576, 'en'), '1 MB')
    assert.equal(formatBytes(undefined, 'en'), '-')
    assert.equal(formatDuration(500, 'en'), '500ms')
    assert.equal(formatDuration(90061000, 'en'), '1d 1h')
    assert.equal(formatDuration(65000, 'en'), '1m 5s')
})

test('watched tables use the backend flag first, then the known list', () => {
    assert.equal(isHighlightedTable({name: 'ai_log'}), true)
    assert.equal(isHighlightedTable({name: 'public.document_edit'}), true)
    assert.equal(isHighlightedTable({name: 'user'}), false)
    assert.equal(isHighlightedTable({name: 'log', highlighted: false}), false)
})
