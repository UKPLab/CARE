"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

/**
 * Dev seed settings inserted after transform-setting-descriptions-i18n.
 * Only description (tooltip) keys — displayName stays plain English.
 *
 * @type {import('sequelize-cli').Migration}
 */

const DESCRIPTION_BY_KEY = {
  "email.template.submissionUpload": "settings.descriptions.email_template_submissionUpload",
  "email.template.submissionUploadConfirmation": "settings.descriptions.email_template_submissionUploadConfirmation",
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
  },
};
