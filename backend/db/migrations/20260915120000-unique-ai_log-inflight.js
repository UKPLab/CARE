"use strict";

const INDEX_NAME = "ai_log_one_inflight_per_user_session";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "${INDEX_NAME}"
      ON "ai_log" ("userId", COALESCE("studySessionId", 0))
      WHERE status = 'in_progress' AND deleted = false
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX_NAME}"`);
  },
};
