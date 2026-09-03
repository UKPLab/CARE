'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "ai_log",
      "aiHookId",
      {
        type: Sequelize.INTEGER,
        references: {
          model: "ai_hook",
          key: "id",
        },
        allowNull: true,
        defaultValue: null,
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ai_log", "aiHookId");
  },
};
