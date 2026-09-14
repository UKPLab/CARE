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

    // Hook spend sums, step-hook per-session, and hook-share attribution.
    await queryInterface.addIndex("ai_log", ["aiHookId", "status", "createdAt"], {
      name: "ai_log_aiHookId_status_createdAt_index",
    });
    await queryInterface.addIndex("ai_log", ["aiHookId", "studySessionId", "status", "createdAt"], {
      name: "ai_log_aiHookId_studySessionId_status_createdAt_index",
    });
    await queryInterface.addIndex("ai_log", ["aiHookId", "userId", "status", "createdAt"], {
      name: "ai_log_aiHookId_userId_status_createdAt_index",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("ai_log", "ai_log_aiHookId_userId_status_createdAt_index");
    await queryInterface.removeIndex("ai_log", "ai_log_aiHookId_studySessionId_status_createdAt_index");
    await queryInterface.removeIndex("ai_log", "ai_log_aiHookId_status_createdAt_index");
    await queryInterface.removeColumn("ai_log", "aiHookId");
  },
};
