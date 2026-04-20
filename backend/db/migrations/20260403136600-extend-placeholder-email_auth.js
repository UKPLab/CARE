"use strict";

const placeholders = [
  {
    type: 1,
    placeholderKey: "otp",
    placeholderLabel: "One-time code",
    placeholderType: "text",
    placeholderDescription: "One-time verification code for email-based two-factor authentication.",
  },
  {
    type: 1,
    placeholderKey: "tokenExpiry",
    placeholderLabel: "Token expiry",
    placeholderType: "text",
    placeholderDescription: "Expiry time in hours or minutes, depending on the email context.",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "placeholder",
      placeholders.map((placeholder) => ({
        ...placeholder,
        required: false,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {},
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "placeholder",
      {
        type: 1,
        placeholderKey: placeholders.map(
          (placeholder) => placeholder.placeholderKey,
        ),
      },
      {},
    );
  },
};
