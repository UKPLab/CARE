"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Backfill rows that were inserted before the DB-level DEFAULT was in place
      await queryInterface.bulkUpdate("ai_hook", { deleted: false }, { deleted: null }, { transaction });
      await queryInterface.changeColumn("ai_hook", "deleted", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });

      await queryInterface.bulkUpdate("ai_hook_models", { deleted: false }, { deleted: null }, { transaction });
      await queryInterface.changeColumn("ai_hook_models", "deleted", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn("ai_hook", "deleted", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      }, { transaction });
      await queryInterface.changeColumn("ai_hook_models", "deleted", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      }, { transaction });
    });
  },
};
