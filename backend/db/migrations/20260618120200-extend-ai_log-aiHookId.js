'use strict';

/**
 * Track the AI hook that triggered each ai_log row so hook-level budget caps
 * can be summed from the log.
 *
 * aiHookId — FK to ai_hook.id; null when the request was not triggered by a
 *            hook (e.g. test prompts, direct chat calls).
 */
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
