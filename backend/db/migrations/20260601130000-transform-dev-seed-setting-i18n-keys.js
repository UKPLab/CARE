"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

/**
 * Dev seed settings inserted after transform-setting-descriptions-i18n.
 *
 * @type {import('sequelize-cli').Migration}
 */

const DESCRIPTION_BY_KEY = {
  "email.template.submissionUpload": "settings.descriptions.email_template_submissionUpload",
  "email.template.submissionUploadConfirmation": "settings.descriptions.email_template_submissionUploadConfirmation",
};

const DISPLAY_NAME_BY_KEY = {
  "email.template.submissionUpload": "settings.displayNames.email_template_submissionUpload",
  "email.template.submissionUploadConfirmation": "settings.displayNames.email_template_submissionUploadConfirmation",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [key, description] of Object.entries(DESCRIPTION_BY_KEY)) {
      await queryInterface.bulkUpdate(
        "setting",
        { description, updatedAt: new Date() },
        { key },
        {}
      );
    }

    for (const [key, displayName] of Object.entries(DISPLAY_NAME_BY_KEY)) {
      await queryInterface.bulkUpdate(
        "setting",
        { displayName, updatedAt: new Date() },
        { key },
        {}
      );
    }
  },

  async down(queryInterface) {
    for (const [key, descriptionKey] of Object.entries(DESCRIPTION_BY_KEY)) {
      const english = resolveEnText(descriptionKey);
      if (!english) {
        continue;
      }
      await queryInterface.bulkUpdate(
        "setting",
        { description: english, updatedAt: new Date() },
        { key, description: descriptionKey },
        {}
      );
    }

    for (const [key, displayNameKey] of Object.entries(DISPLAY_NAME_BY_KEY)) {
      const english = resolveEnText(displayNameKey);
      if (!english) {
        continue;
      }
      await queryInterface.bulkUpdate(
        "setting",
        { displayName: english, updatedAt: new Date() },
        { key, displayName: displayNameKey },
        {}
      );
    }
  },
};
