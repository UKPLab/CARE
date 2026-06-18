'use strict';

/**
 * Add study-wide AI budget fields to the study table.
 *
 * aiCostLimit — global cap on total AI spend across all participants in
 *               this study (null = unlimited).
 * aiResetAt   — timestamp; ai_log rows older than this stop counting toward
 *               the study cap. Reset by setting to NOW().
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "study",
        "aiCostLimit",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "study",
        "aiResetAt",
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
      await queryInterface.removeColumn("study", "aiCostLimit", { transaction });
      await queryInterface.removeColumn("study", "aiResetAt", { transaction });
    });
  },
};
