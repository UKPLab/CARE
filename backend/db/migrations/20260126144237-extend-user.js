"use strict";

const columns = [
  {
    name: "twoFactorEnabled",
    type: "BOOLEAN",
    defaultValue: false,
    allowNull: false,
  },
  {
    name: "twoFactorMethod",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
  },
  {
    name: "twoFactorOtp",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
  },
  {
    name: "twoFactorOtpExpiresAt",
    type: "DATE",
    allowNull: true,
    defaultValue: null,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const column of columns) {
      await queryInterface.addColumn("user", column.name, {
        type: Sequelize[column.type],
        defaultValue: column.defaultValue,
        allowNull: column.allowNull,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const column of columns) {
      await queryInterface.removeColumn("user", column.name);
    }
  },
};
