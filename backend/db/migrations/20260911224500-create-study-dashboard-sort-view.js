"use strict";

const {
    VIEW_NAME,
    createMaterializedViewSql,
} = require("../studyDashboardSortSql.js");

/**
 * Physical sort keys for Studies dashboard Status / Sessions columns.
 * queryTable cannot ORDER BY those derived values as study columns; the view is cheap to read
 * and refreshed after study/session writes (and before a stale Status sort).
 *
 * Pins study.start, study.end, study.closed, study.multipleSubmit, study_session.studyId
 * and study_session.deleted. changeColumn on those must drop this view first and recreate it.
 */
module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(createMaterializedViewSql());
        await queryInterface.addIndex(VIEW_NAME, ["id"], {
            name: `${VIEW_NAME}_id`,
            unique: true,
        });
        await queryInterface.addIndex(VIEW_NAME, ["stateRank", "id"], {
            name: `${VIEW_NAME}_rank_id`,
        });
        await queryInterface.addIndex(VIEW_NAME, ["sessions", "id"], {
            name: `${VIEW_NAME}_sessions_id`,
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`DROP MATERIALIZED VIEW IF EXISTS "${VIEW_NAME}" CASCADE;`);
    },
};
