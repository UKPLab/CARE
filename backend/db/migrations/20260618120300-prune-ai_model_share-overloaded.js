'use strict';

/**
 * Strip the study-scoping and notification columns that were retrofitted onto
 * ai_model_share. With the new design, study budgets live on the study table,
 * session budgets live on step config, and notifications are out of scope.
 *
 * Dropped:
 *   studyId, studySessionId, applyPerSession, notifyThreshold
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("ai_model_share", "studySessionId", { transaction });
      await queryInterface.removeColumn("ai_model_share", "applyPerSession", { transaction });
      await queryInterface.removeColumn("ai_model_share", "studyId", { transaction });
      await queryInterface.removeColumn("ai_model_share", "notifyThreshold", { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "ai_model_share",
        "studyId",
        {
          type: Sequelize.INTEGER,
          references: { model: "study", key: "id" },
          allowNull: true,
          onDelete: "CASCADE",
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "ai_model_share",
        "studySessionId",
        {
          type: Sequelize.INTEGER,
          references: { model: "study_session", key: "id" },
          allowNull: true,
          onDelete: "CASCADE",
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "ai_model_share",
        "applyPerSession",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "ai_model_share",
        "notifyThreshold",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );
    });
  },
};
