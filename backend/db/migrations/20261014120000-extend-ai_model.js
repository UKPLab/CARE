"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Model context window in tokens; the chat guard derives its soft/hard limits from it. Null = no cap.
      await queryInterface.addColumn(
        "ai_model",
        "contextWindowTokens",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("ai_model", "contextWindowTokens", { transaction });
    });
  },
};
