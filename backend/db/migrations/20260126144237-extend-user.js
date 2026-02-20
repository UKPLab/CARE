"use strict";

const columns = [
  // Email OTP for 2FA
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
  // LDAP support
  {
    name: "ldapDomain",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
  },
  {
    name: "ldapUsername",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
  },
  // ORCID support
  {
    name: "orcidId",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
    unique: true,
  },
  // SAML support
  {
    name: "samlNameId",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
    unique: true,
  },
  // Multi-method 2FA configuration
  {
    name: "twoFactorMethods",
    type: "JSON",
    allowNull: false,
    defaultValue: [],
  },
  {
    name: "totpSecret",
    type: "STRING",
    allowNull: true,
    defaultValue: null,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("user", "email", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    for (const column of columns) {
      await queryInterface.addColumn("user", column.name, {
        type: Sequelize[column.type],
        defaultValue: column.defaultValue,
        allowNull: column.allowNull,
        ...(column.unique ? { unique: true } : {}),
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const column of columns) {
      await queryInterface.removeColumn("user", column.name);
    }
  },
};
