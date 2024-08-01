"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.renameColumn("user", "acceptTerms", "termsConsented", { transaction });
      await queryInterface.renameColumn("user", "acceptStats", "trackingAgreed", { transaction });

      // column to document the time when the consent was given
      await queryInterface.addColumn(
        "user",
        "consentedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // column to indicate whether the user agreed to share their annotation data
      await queryInterface.addColumn(
        "user",
        "dataShared",
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
      await queryInterface.renameColumn("user", "termsConsented", "acceptTerms", { transaction });
      await queryInterface.renameColumn("user", "trackingAgreed", "acceptStats", { transaction });
      await queryInterface.removeColumn("user", "consentedAt", { transaction });
      await queryInterface.removeColumn("user", "dataShared", { transaction });
    });
  },
};
