"use strict";

/**
 * SQL that fills materialized view study_dashboard_sort.
 * queryTable sort / filter / search read the view; keep in sync with enrichStudyRow() in Study.vue.
 *
 * The view pins study.start, study.end, study.closed, study.multipleSubmit,
 * study_session.studyId and study_session.deleted. A later changeColumn on those
 * must DROP MATERIALIZED VIEW study_dashboard_sort first and recreate it.
 */

const STATE_SQL = `CASE
    WHEN "study"."start" IS NOT NULL AND "study"."start" > NOW() THEN 'not started'
    WHEN "study"."end" IS NOT NULL AND "study"."end" < NOW() THEN
        CASE WHEN "study"."multipleSubmit"
            THEN CASE WHEN "study"."closed" IS NOT NULL THEN 'closed' ELSE 'running' END
            ELSE 'ended'
        END
    ELSE CASE WHEN "study"."closed" IS NOT NULL THEN 'closed' ELSE 'running' END
END`;

const STATES = ["not started", "running", "closed", "ended"];

const SESSION_COUNT_SQL = `(SELECT COUNT(*) FROM "study_session"
    WHERE "study_session"."studyId" = "study"."id" AND "study_session"."deleted" = false)`;

const STATE_RANK_SQL = `CASE (${STATE_SQL})
    WHEN 'not started' THEN 0
    WHEN 'running' THEN 1
    WHEN 'closed' THEN 2
    WHEN 'ended' THEN 3
    ELSE 4
END`;

const VIEW_NAME = "study_dashboard_sort";

function createMaterializedViewSql() {
    return `
CREATE MATERIALIZED VIEW "${VIEW_NAME}" AS
SELECT
    "study"."id" AS id,
    (${STATE_SQL}) AS state,
    (${STATE_RANK_SQL}) AS "stateRank",
    (${SESSION_COUNT_SQL})::integer AS sessions
FROM "study"
WITH DATA;
`;
}

module.exports = {
    STATES,
    VIEW_NAME,
    createMaterializedViewSql,
};
