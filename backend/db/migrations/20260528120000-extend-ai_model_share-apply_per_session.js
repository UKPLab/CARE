'use strict';

/**
 * Add applyPerSession to ai_model_share.
 *
 * When true on a study-scoped row (studyId set, studySessionId null), the row
 * acts as a per-session template: on each new study_session, the afterCreate
 * hook copies the row into a session-scoped row with the new studySessionId.
 * The original template row itself is never consulted by the runtime —
 * `budget.js` only sees the materialized session-scoped rows.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ai_model_share", "applyPerSession", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ai_model_share", "applyPerSession");
  },
};
