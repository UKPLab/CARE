"use strict";

const { translateMaybeKey } = require("../../utils/i18n");

/**
 * Replace English placeholderLabel / placeholderDescription with i18n keys.
 * Help tooltips stay in templates.json (frontend derives help key from description key).
 *
 * @type {import('sequelize-cli').Migration}
 */

const TYPE_SLUG = {
  1: "emailGeneral",
  2: "emailStudySession",
  3: "emailAssignment",
  6: "emailStudyClose",
};

const PLACEHOLDER_ROWS = [
  { type: 1, placeholderKey: "username" },
  { type: 1, placeholderKey: "firstName" },
  { type: 1, placeholderKey: "lastName" },
  { type: 1, placeholderKey: "link" },
  { type: 1, placeholderKey: "otp" },
  { type: 1, placeholderKey: "tokenExpiry" },
  { type: 2, placeholderKey: "username" },
  { type: 2, placeholderKey: "link" },
  { type: 3, placeholderKey: "username" },
  { type: 3, placeholderKey: "assignmentType" },
  { type: 3, placeholderKey: "assignmentName" },
  { type: 3, placeholderKey: "link" },
  { type: 6, placeholderKey: "username" },
  { type: 6, placeholderKey: "studyName" },
];

function keysFor(type, placeholderKey) {
  const slug = TYPE_SLUG[type];
  const base = "templates.placeholders";
  return {
    placeholderLabel: `${base}.labels.${slug}.${placeholderKey}`,
    placeholderDescription: `${base}.descriptions.${slug}.${placeholderKey}`,
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const row of PLACEHOLDER_ROWS) {
      await queryInterface.bulkUpdate(
        "placeholder",
        {
          ...keysFor(row.type, row.placeholderKey),
          updatedAt: new Date(),
        },
        {
          type: row.type,
          placeholderKey: row.placeholderKey,
        },
        {},
      );
    }
  },

  async down(queryInterface) {
    for (const row of PLACEHOLDER_ROWS) {
      const keys = keysFor(row.type, row.placeholderKey);
      const placeholderLabel = translateMaybeKey(keys.placeholderLabel);
      const placeholderDescription = translateMaybeKey(keys.placeholderDescription);
      if (!placeholderLabel || !placeholderDescription) {
        continue;
      }
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
