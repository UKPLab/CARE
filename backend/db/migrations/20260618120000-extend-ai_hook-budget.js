'use strict';

/**
 * Add owner-level budget fields to the ai_hook table.
 *
 * costLimit — global cap on total spend across all invocations of this hook
 *             (null = unlimited).
 * resetAt   — timestamp; ai_log rows older than this stop counting toward
 *             the hook cap. Reset by setting to NOW().
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "ai_hook",
        "costLimit",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "ai_hook",
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
      await queryInterface.removeColumn("ai_hook", "costLimit", { transaction });
      await queryInterface.removeColumn("ai_hook", "resetAt", { transaction });
    });
  },
};
