"use strict";

const { translateMaybeKey } = require("../../utils/i18n");

/**
 * Replace English placeholderLabel / placeholderDescription for email template type 7.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TYPE_SLUG = "emailSubmissionUpload";

const PLACEHOLDER_ROWS = [
  { type: 7, placeholderKey: "username" },
  { type: 7, placeholderKey: "assignmentName" },
  { type: 7, placeholderKey: "eventType" },
  { type: 7, placeholderKey: "assignmentId" },
  { type: 7, placeholderKey: "submissionId" },
  { type: 7, placeholderKey: "timestamp" },
];

function keysFor(placeholderKey) {
  const base = "templates.placeholders";
  return {
    placeholderLabel: `${base}.labels.${TYPE_SLUG}.${placeholderKey}`,
    placeholderDescription: `${base}.descriptions.${TYPE_SLUG}.${placeholderKey}`,
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const row of PLACEHOLDER_ROWS) {
      await queryInterface.bulkUpdate(
        "placeholder",
        {
          ...keysFor(row.placeholderKey),
          updatedAt: new Date(),
        },
        {
          type: row.type,
          placeholderKey: row.placeholderKey,
        },
        {}
      );
    }
  },

  async down(queryInterface) {
    for (const row of PLACEHOLDER_ROWS) {
      const keys = keysFor(row.placeholderKey);
      const placeholderLabel = translateMaybeKey(keys.placeholderLabel);
      const placeholderDescription = translateMaybeKey(keys.placeholderDescription);
      await queryInterface.bulkUpdate(
        "placeholder",
        {
          placeholderLabel,
          placeholderDescription,
          updatedAt: new Date(),
        },
        {
          type: row.type,
          placeholderKey: row.placeholderKey,
        },
        {}
      );
    }
  },
};
