"use strict";

const {VIEW_NAME} = require("./studyDashboardSortSql.js");
const createLogger = require("../utils/logger");

let logger = null;

// Columns the study_dashboard_sort view reads. Updates to other columns cannot change it.
const VIEW_FIELDS = {
    study: ["start", "end", "closed", "multipleSubmit"],
    study_session: ["studyId", "deleted"],
};
const WATCH_TABLES = new Set(Object.keys(VIEW_FIELDS));
const STATE_STALE_MS = 60 * 1000;
const DEBOUNCE_MS = 250;

// generation is the latest write. seenGeneration is the latest write a finished refresh includes.
let generation = 1;
let seenGeneration = 0;
let lastRefreshAt = 0;
let inFlight = null;
let debounceTimer = null;

function markDirty() {
    generation += 1;
}

async function refreshStudyDashboardSort(sequelize) {
    if (!sequelize) {
        return;
    }
    // Only writes already marked when this call started. Later writes schedule their own refresh.
    const want = generation;
    while (seenGeneration < want) {
        if (inFlight) {
            await inFlight;
            continue;
        }
        const target = generation;
        inFlight = sequelize.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${VIEW_NAME}"`)
            .then(() => {
                lastRefreshAt = Date.now();
                seenGeneration = Math.max(seenGeneration, target);
            })
            .finally(() => {
                inFlight = null;
            });
        await inFlight;
    }
}

function scheduleStudyDashboardSortRefresh(sequelize, transaction) {
    const kick = () => {
        // Bump here, not in the hook: afterCommit, or immediately when there is no transaction.
        markDirty();
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            refreshStudyDashboardSort(sequelize).catch((err) => {
                if (!logger) {
                    logger = createLogger("studyDashboardSort");
                }
                logger.warn("study_dashboard_sort refresh failed: " + err.message);
            });
        }, DEBOUNCE_MS);
    };
    if (transaction && typeof transaction.afterCommit === "function") {
        transaction.afterCommit(kick);
        return;
    }
    kick();
}

/**
 * Status uses NOW(), so the view can go stale with no writes. Refresh before a derived
 * sort / filter / search if something wrote, or if Status is older than a minute.
 *
 * lazy: each study / study_session write schedules one REFRESH MATERIALIZED VIEW CONCURRENTLY
 * of every study (debounced). A Status sort waits for that refresh when the view is older
 * than a minute. Replace the view with a live query if that wait shows up in list latency.
 *
 * @param {import("sequelize").Sequelize} sequelize
 * @param {string} viewField stateRank | sessions
 */
async function ensureStudyDashboardSortFresh(sequelize, viewField) {
    const clockStale = viewField === "stateRank"
        && lastRefreshAt > 0
        && (Date.now() - lastRefreshAt > STATE_STALE_MS);
    if (clockStale && seenGeneration >= generation) {
        generation += 1;
    }
    if (seenGeneration >= generation) {
        return;
    }
    await refreshStudyDashboardSort(sequelize);
}

/**
 * Check if an update touched a column the view depends on.
 *
 * @param {string} table
 * @param {import("sequelize").Model} instance
 * @returns {boolean}
 */
function hasViewRelevantChange(table, instance) {
    const fields = VIEW_FIELDS[table];
    if (!fields) {
        return false;
    }
    if (typeof instance?.changed !== "function") {
        // Cannot tell what changed, so refresh to stay correct.
        return true;
    }
    return fields.some((field) => instance.changed(field));
}

function attachStudyDashboardSortHooks(sequelize) {
    const getWatchedTable = (instance) => {
        const table = instance?.constructor?.tableName;
        return WATCH_TABLES.has(table) ? table : null;
    };
    const scheduleAlways = (instance, options) => {
        if (!getWatchedTable(instance)) {
            return;
        }
        scheduleStudyDashboardSortRefresh(sequelize, options?.transaction);
    };
    const scheduleOnRelevantUpdate = (instance, options) => {
        const table = getWatchedTable(instance);
        if (!table || !hasViewRelevantChange(table, instance)) {
            return;
        }
        scheduleStudyDashboardSortRefresh(sequelize, options?.transaction);
    };
    sequelize.addHook("afterCreate", scheduleAlways);
    sequelize.addHook("afterUpdate", scheduleOnRelevantUpdate);
    sequelize.addHook("afterDestroy", scheduleAlways);
}

module.exports = {
    ensureStudyDashboardSortFresh,
    attachStudyDashboardSortHooks,
};
