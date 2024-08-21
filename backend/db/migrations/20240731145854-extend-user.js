"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // column to document the time when the consent was given
      await queryInterface.addColumn(
        "user",
        "acceptedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // column to indicate whether the user agreed to share their annotation data
      await queryInterface.addColumn(
        "user",
        "acceptDataSharing",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("user", "acceptedAt", { transaction });
      await queryInterface.removeColumn("user", "acceptDataSharing", { transaction });
    });
  },
};
