'use strict';

/**
 * Add model-wide budget fields to the ai_model table.
 *
 * costLimit — global cap on total spend across all users on this model
 *             (null = unlimited).
 * resetAt   — timestamp; ai_log rows older than this stop counting toward
 *             the model cap. Reset by setting to NOW().
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "ai_model",
        "costLimit",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "ai_model",
        "resetAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("ai_model", "costLimit", { transaction });
      await queryInterface.removeColumn("ai_model", "resetAt", { transaction });
    });
  },
};
