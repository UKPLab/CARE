"use strict";

const {VIEW_NAME} = require("./studyDashboardSortSql.js");

const WATCH_TABLES = new Set(["study", "study_session"]);
const STATE_STALE_MS = 60 * 1000;
const DEBOUNCE_MS = 250;

let studyCacheModel = null;
let dirty = true;
let lastRefreshAt = 0;
let inFlight = null;
let debounceTimer = null;

function markDirty() {
    dirty = true;
}

async function refreshStudyDashboardSort(sequelize) {
    if (!sequelize) {
        return;
    }
    if (inFlight) {
        await inFlight;
        return;
    }
    inFlight = sequelize.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${VIEW_NAME}"`)
        .then(() => {
            dirty = false;
            lastRefreshAt = Date.now();
            if (typeof studyCacheModel?.clearCache === "function") {
                studyCacheModel.clearCache();
            }
        })
        .finally(() => {
            inFlight = null;
        });
    await inFlight;
}

function scheduleStudyDashboardSortRefresh(sequelize, transaction) {
    markDirty();
    const kick = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            refreshStudyDashboardSort(sequelize).catch((err) => {
                console.warn("study_dashboard_sort refresh failed:", err.message);
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
 * @param {import("sequelize").Sequelize} sequelize
 * @param {string} viewField stateRank | sessions
 */
async function ensureStudyDashboardSortFresh(sequelize, viewField) {
    const staleClock = viewField === "stateRank" && (Date.now() - lastRefreshAt > STATE_STALE_MS);
    if (!dirty && !staleClock) {
        return;
    }
    await refreshStudyDashboardSort(sequelize);
}

function attachStudyDashboardSortHooks(sequelize, models = {}) {
    studyCacheModel = models.study || sequelize.models.study || null;
    const maybeSchedule = (instance, options) => {
        const table = instance?.constructor?.tableName;
        if (!WATCH_TABLES.has(table)) {
            return;
        }
        scheduleStudyDashboardSortRefresh(sequelize, options?.transaction);
    };
    sequelize.addHook("afterCreate", maybeSchedule);
    sequelize.addHook("afterUpdate", maybeSchedule);
    sequelize.addHook("afterDestroy", maybeSchedule);
}

module.exports = {
    refreshStudyDashboardSort,
    scheduleStudyDashboardSortRefresh,
    ensureStudyDashboardSortFresh,
    attachStudyDashboardSortHooks,
    VIEW_NAME,
};
