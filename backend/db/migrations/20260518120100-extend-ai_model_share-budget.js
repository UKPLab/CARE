'use strict';

/**
 * Add study scope and per-user budget fields to the ai_model_share table.
 *
 * studyId         — when set, the share applies only inside this study.
 *                   The row's costLimit then becomes a per-user quota
 *                   (this costLimit is the limit for each user in the study ).
 * costLimit       — per-user spending cap (null = unlimited).
 * resetAt         — timestamp; ai_log rows older than this stop counting
 *                   toward this share's cap. Reset by setting to NOW().
 * notifyThreshold — 0..1 fraction; email cap owner once usage ratio
 *                   crosses this value (null = no notification).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "ai_model_share",
        "studyId",
        {
          type: Sequelize.INTEGER,
          references: {
            model: "study",
            key: "id",
          },
          allowNull: true,
          onDelete: "CASCADE",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "ai_model_share",
        "costLimit",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "ai_model_share",
        "resetAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("ai_model_share", "studyId", { transaction });
      await queryInterface.removeColumn("ai_model_share", "costLimit", { transaction });
      await queryInterface.removeColumn("ai_model_share", "resetAt", { transaction });
      await queryInterface.removeColumn("ai_model_share", "notifyThreshold", { transaction });
    });
  },
};
