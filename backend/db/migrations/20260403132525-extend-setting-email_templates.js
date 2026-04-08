'use strict';

const settings = [
  {
    key: "email.template.twoFactorOtp",
    value: "",
    type: "number",
    description: "Template type for two-factor authentication code emails (Email - General). Leave empty to use the fallback email from disk."
  },
  {
    key: "email.template.passwordResetSuccess",
    value: "",
    type: "number",
    description: "Template type for password reset success emails (Email - General). Leave empty to use the fallback email from disk."
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "setting",
      settings.map((setting) => ({
        ...setting,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "setting",
      { key: settings.map((setting) => setting.key) },
      {}
    );
  },
};
