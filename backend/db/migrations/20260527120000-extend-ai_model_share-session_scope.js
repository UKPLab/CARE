'use strict';

/**
 * Add session scope to ai_model_share. When set, the share's costLimit
 * applies only inside this study_session (each user in the session has their
 * own quota of costLimit). Lookup precedence at request time:
 *
 *   session row → study row → global user row.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ai_model_share", "studySessionId", {
      type: Sequelize.INTEGER,
      references: {
        model: "study_session",
        key: "id",
      },
      allowNull: true,
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ai_model_share", "studySessionId");
  },
};
