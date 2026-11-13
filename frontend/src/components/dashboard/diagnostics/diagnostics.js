/**
 * Data contract and pure helpers for the admin Diagnostics dashboard (#526).
 *
 * The page asks the backend for one read-only snapshot of the current
 * PostgreSQL database and renders each section on its own. Nothing in this
 * file talks to the socket or Vue, so it can be unit tested with `node --test`.
 *
 * ## Socket contract
 *
 * Event: `diagnosticsGet` (backend `webserver/sockets/diagnostics.js`, admin only,
 * no transaction). Request payload: `{}`. The ack is the usual createSocket shape:
 * `{ success: true, data: DiagnosticsSnapshot }`, or `{ success: false, key|message }`
 * (e.g. `errors.users.adminAccessRequired`).
 *
 * Status values are always `"ok" | "warning" | "critical"`. The backend applies the
 * `diagnostics.*` threshold settings and sends the effective values as `thresholds`.
 * Section and overall status always come from the backend. Per-metric `checks` are
 * optional: when one is missing, deriveChecks() colors that metric with the same
 * `thresholds`, so the limits still have a single source.
 *
 * Sections are collected one after another and each query may run up to
 * `thresholds.queryTimeoutMs` (max 10 s), so the client waits long enough for all
 * of them (see requestTimeoutMs()).
 *
 * Privacy: only the current database. No client addresses, user names or
 * application names are sent.
 *
 * @typedef {"ok"|"warning"|"critical"} DiagnosticsStatus
 *
 * @typedef {Object} DiagnosticsSection
 * @property {boolean} available - false when the section's queries failed or timed out
 * @property {DiagnosticsStatus} [status] - worst status of the section's checks
 * @property {string} [error] - optional i18n key with the failure reason
 * @property {string} [reason] - short failure code, e.g. "unavailable" (not shown)
 * @property {Object<string, DiagnosticsStatus>} [checks] - per-metric status, keys listed below
 * @property {Object} [data] - section payload, see below
 *
 * @typedef {Object} DiagnosticsSnapshot
 * @property {DiagnosticsStatus} status - overall status (worst section)
 * @property {string} collectedAt - ISO timestamp
 * @property {number} [autoRefreshSeconds] - setting `diagnostics.autoRefreshSeconds`
 * @property {Object} [thresholds] - effective `diagnostics.*` settings: queryTimeoutMs,
 *   connectionWarningPct/CriticalPct, queryWarningSeconds/CriticalSeconds,
 *   cacheWarningPct/CriticalPct (lower is worse), rollbackWarningPct/CriticalPct,
 *   wraparoundWarningAge/CriticalAge
 * @property {Object} sections
 * @property {DiagnosticsSection} sections.server
 *   data: { version, database, startedAt: ISO, uptimeSeconds, sizeBytes, wraparoundAge }
 * @property {DiagnosticsSection} sections.connections
 *   data: { used, max, usedPct, active, idle, idleInTransaction,
 *           pool: { max, min, size, available, using, waiting } | null }
 *   checks: usedPct, idleInTransaction, poolWaiting
 * @property {DiagnosticsSection} sections.queries
 *   data: { longest: [{ pid, durationMs, waitEventType, waitEvent, query (truncated, literals redacted) }],
 *           waitingLocks: number,
 *           blocking: [{ blockedPid, blockingPid, waitingMs }] }
 *   checks: longestQuery, waitingLocks
 * @property {DiagnosticsSection} sections.efficiency
 *   data: { cacheHitPct, rollbackPct, deadlocks, tempFiles, tempBytes, statsResetAt }
 *   checks: cacheHitPct, rollbackPct, deadlocks, tempFiles
 * @property {DiagnosticsSection} sections.storage
 *   data: { databaseBytes,
 *           tables: [{ name, rows, deadRows, deadPct, totalBytes, highlighted?, status? }] }
 *   checks: databaseBytes, deadPct
 * @property {DiagnosticsSection} sections.maintenance
 *   data: { wraparound: { age, pct },
 *           tables: [{ name, lastVacuum, lastAnalyze, status? }]  (most recent of manual/auto),
 *           unusedIndexes: [{ table, index, sizeBytes }] }
 *   checks: wraparoundPct, staleVacuum, unusedIndexes
 * @property {DiagnosticsSection} sections.migrations
 *   data: { last: { name } | null, appliedCount, pending: string[] }
 *   checks: pending
 *
 * @author Akash Gundapuneni
 */

export const SOCKET_EVENT = "diagnosticsGet";

/** Backend clamps `diagnostics.queryTimeoutMs` to this value. */
export const MAX_QUERY_TIMEOUT_MS = 10000;

/** Most sequential read-only queries per snapshot (settings, server, 6 sections, lock count). */
export const SEQUENTIAL_QUERIES = 9;

/** Extra time for transaction setup, the socket round trip and a busy pool. */
const REQUEST_SLACK_MS = 15000;

/**
 * How long the client waits for the ack before showing a timeout. Uses the
 * backend's query timeout once known, else the largest value it allows.
 * @param {number} [queryTimeoutMs]
 * @returns {number}
 */
export function requestTimeoutMs(queryTimeoutMs) {
  const perQuery = Number(queryTimeoutMs) > 0
    ? Math.min(MAX_QUERY_TIMEOUT_MS, Number(queryTimeoutMs))
    : MAX_QUERY_TIMEOUT_MS;
  return SEQUENTIAL_QUERIES * perQuery + REQUEST_SLACK_MS;
}

/** Used when the backend does not send `autoRefreshSeconds`. */
export const DEFAULT_AUTO_REFRESH_SECONDS = 30;

/** Shortest auto-refresh interval the page accepts, to keep catalog queries cheap. */
export const MIN_AUTO_REFRESH_SECONDS = 10;

export const SECTION_KEYS = Object.freeze([
  "server",
  "connections",
  "queries",
  "efficiency",
  "storage",
  "maintenance",
  "migrations",
]);

/** Tables that grow with usage and are worth watching (issue #526). */
export const HIGHLIGHTED_TABLES = Object.freeze(["log", "statistic", "trace", "document_edit", "ai_log"]);

const STATUS_RANK = { ok: 0, warning: 1, critical: 2 };

/** Bootstrap classes per status; `unknown` covers missing or unavailable data. */
export const STATUS_STYLE = Object.freeze({
  ok: { badge: "text-bg-success", text: "text-success", icon: "check-circle-fill" },
  warning: { badge: "text-bg-warning", text: "text-warning-emphasis", icon: "exclamation-triangle-fill" },
  critical: { badge: "text-bg-danger", text: "text-danger", icon: "x-octagon-fill" },
  unknown: { badge: "text-bg-secondary", text: "text-body-secondary", icon: "question-circle" },
});

/**
 * Map any value to a known status, or "unknown".
 * @param {*} value
 * @returns {DiagnosticsStatus|"unknown"}
 */
export function toStatus(value) {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  return status in STATUS_RANK ? status : "unknown";
}

/**
 * Worst known status in a list; "unknown" when none is known.
 * @param {Array<*>} statuses
 * @returns {DiagnosticsStatus|"unknown"}
 */
export function worstStatus(statuses) {
  let worst = "unknown";
  for (const value of statuses || []) {
    const status = toStatus(value);
    if (status === "unknown") continue;
    if (worst === "unknown" || STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

/**
 * Normalize one section so the UI never has to guard against missing fields.
 * A section without `available: true` and data is treated as unavailable.
 * @param {*} raw
 * @returns {{available: boolean, status: string, error: string|null, checks: Object, data: Object}}
 */
export function normalizeSection(raw) {
  const isObject = raw && typeof raw === "object";
  const data = isObject && raw.data && typeof raw.data === "object" ? raw.data : {};
  const available = Boolean(isObject && raw.available !== false && raw.data && typeof raw.data === "object");
  return {
    available,
    status: available ? toStatus(raw.status) : "unknown",
    error: isObject && typeof raw.error === "string" ? raw.error : null,
    checks: isObject && raw.checks && typeof raw.checks === "object" ? raw.checks : {},
    data,
  };
}

/**
 * Normalize the full snapshot. Missing sections become unavailable rather than
 * breaking the page, and the overall status falls back to the worst section.
 * @param {*} raw - `data` of the socket ack
 * @returns {{status: string, collectedAt: string|null, queryTimeoutMs: number|null,
 *   autoRefreshSeconds: number, sections: Object}}
 */
export function normalizeSnapshot(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawSections = source.sections && typeof source.sections === "object" ? source.sections : {};
  const sections = {};
  for (const key of SECTION_KEYS) sections[key] = normalizeSection(rawSections[key]);

  const status = toStatus(source.status) !== "unknown"
    ? toStatus(source.status)
    : worstStatus(SECTION_KEYS.map((key) => sections[key].status));

  const thresholds = source.thresholds && typeof source.thresholds === "object" ? source.thresholds : {};
  deriveChecks(sections, thresholds);

  const seconds = Number(source.autoRefreshSeconds);
  return {
    status,
    collectedAt: typeof source.collectedAt === "string" ? source.collectedAt : null,
    queryTimeoutMs: isNumeric(thresholds.queryTimeoutMs) ? Number(thresholds.queryTimeoutMs) : null,
    autoRefreshSeconds: Number.isFinite(seconds) && seconds > 0
      ? Math.max(MIN_AUTO_REFRESH_SECONDS, Math.round(seconds))
      : DEFAULT_AUTO_REFRESH_SECONDS,
    sections,
  };
}

/**
 * Status of one value against a warning/critical pair (inclusive, like the backend).
 * @param {*} value
 * @param {*} warning
 * @param {*} critical
 * @param {boolean} [lowerIsWorse=false] - e.g. cache hit ratio
 * @returns {DiagnosticsStatus|undefined} undefined when the value or a limit is missing
 */
export function levelFor(value, warning, critical, lowerIsWorse = false) {
  if (!isNumeric(value) || !isNumeric(warning) || !isNumeric(critical)) return undefined;
  const n = Number(value);
  const worse = (limit) => (lowerIsWorse ? n <= Number(limit) : n >= Number(limit));
  if (worse(critical)) return "critical";
  if (worse(warning)) return "warning";
  return "ok";
}

/**
 * Fill missing per-metric checks from the backend's effective thresholds.
 * Checks the backend already sent are kept. Mutates the normalized sections.
 * @param {Object} sections - normalized sections
 * @param {Object} thresholds - `thresholds` from the snapshot
 * @returns {void}
 */
export function deriveChecks(sections, thresholds) {
  const t = thresholds || {};
  const fill = (key, metric, status) => {
    const section = sections[key];
    if (!section || !section.available || status === undefined || metric in section.checks) return;
    section.checks = { ...section.checks, [metric]: status };
  };

  const connections = sections.connections?.data || {};
  const usedPct = isNumeric(connections.usedPct)
    ? connections.usedPct
    : Number(connections.max) > 0 ? (Number(connections.used) / Number(connections.max)) * 100 : null;
  fill("connections", "usedPct", levelFor(usedPct, t.connectionWarningPct, t.connectionCriticalPct));

  const longest = Array.isArray(sections.queries?.data?.longest) ? sections.queries.data.longest : [];
  const durations = longest.map((q) => Number(q.durationMs)).filter(Number.isFinite);
  const longestSeconds = durations.length ? Math.max(...durations) / 1000 : 0;
  fill("queries", "longestQuery", levelFor(longestSeconds, t.queryWarningSeconds, t.queryCriticalSeconds));

  const efficiency = sections.efficiency?.data || {};
  fill("efficiency", "cacheHitPct", levelFor(efficiency.cacheHitPct, t.cacheWarningPct, t.cacheCriticalPct, true));
  fill("efficiency", "rollbackPct", levelFor(efficiency.rollbackPct, t.rollbackWarningPct, t.rollbackCriticalPct));

  const age = sections.maintenance?.data?.wraparound?.age ?? sections.server?.data?.wraparoundAge;
  fill("maintenance", "wraparoundPct", levelFor(age, t.wraparoundWarningAge, t.wraparoundCriticalAge));
}

/**
 * True for a finite number (including numeric strings, which pg returns for bigint).
 * @param {*} value
 * @returns {boolean}
 */
export function isNumeric(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

/**
 * Locale-aware integer/decimal, or "-" when missing.
 * @param {*} value
 * @param {string} locale
 * @param {number} [digits=0]
 * @returns {string}
 */
export function formatNumber(value, locale, digits = 0) {
  if (!isNumeric(value)) return "-";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(value));
}

/**
 * Locale-aware percentage from a 0–100 value, or "-".
 * @param {*} value
 * @param {string} locale
 * @param {number} [digits=1]
 * @returns {string}
 */
export function formatPercent(value, locale, digits = 1) {
  if (!isNumeric(value)) return "-";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits })
    .format(Number(value) / 100);
}

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];

/**
 * Human-readable size with localized units (1024 based), or "-".
 * @param {*} value - bytes
 * @param {string} locale
 * @returns {string}
 */
export function formatBytes(value, locale) {
  if (!isNumeric(value)) return "-";
  let size = Math.max(0, Number(value));
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: BYTE_UNITS[unit],
    unitDisplay: "short",
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(size);
}

const DURATION_PARTS = [
  ["day", 86400000],
  ["hour", 3600000],
  ["minute", 60000],
  ["second", 1000],
];

/**
 * Compact duration with the two largest localized units ("3 d 4 h", "2 min 5 s").
 * Sub-second values are shown in milliseconds.
 * @param {*} ms
 * @param {string} locale
 * @returns {string}
 */
export function formatDuration(ms, locale) {
  if (!isNumeric(ms)) return "-";
  const total = Math.max(0, Number(ms));
  const unitFormat = (unit, amount) => new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 0,
  }).format(amount);

  if (total < 1000) return unitFormat("millisecond", Math.round(total));

  const index = DURATION_PARTS.findIndex(([, size]) => total >= size);
  const [unit, size] = DURATION_PARTS[index];
  const major = Math.floor(total / size);
  const parts = [unitFormat(unit, major)];
  const next = DURATION_PARTS[index + 1];
  if (next) {
    const minor = Math.floor((total - major * size) / next[1]);
    if (minor > 0) parts.push(unitFormat(next[0], minor));
  }
  return parts.join(" ");
}

/**
 * True when the table is one of the watched, fast-growing tables.
 * The backend flag wins when present.
 * @param {{name: string, highlighted?: boolean}} table
 * @returns {boolean}
 */
export function isHighlightedTable(table) {
  if (!table) return false;
  if (typeof table.highlighted === "boolean") return table.highlighted;
  return HIGHLIGHTED_TABLES.includes(String(table.name || "").replace(/^public\./, ""));
}
