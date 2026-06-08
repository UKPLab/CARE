"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

/** Assignment-related user rights added after transform-user_right-descriptions-i18n. */
const DESCRIPTION_BY_NAME = {
  "frontend.dashboard.assignments.view": "users.rightDescriptions.frontend_dashboard_assignments_view",
  "frontend.dashboard.assignments.viewAll": "users.rightDescriptions.frontend_dashboard_assignments_viewAll",
  "frontend.dashboard.assignments.uploadForOthers": "users.rightDescriptions.frontend_dashboard_assignments_uploadForOthers",
  "frontend.dashboard.assignments.edit": "users.rightDescriptions.frontend_dashboard_assignments_edit",
  "frontend.dashboard.assignments.replaceDeleteSubmissions": "users.rightDescriptions.frontend_dashboard_assignments_replaceDeleteSubmissions",
  "frontend.dashboard.submissions.view": "users.rightDescriptions.frontend_dashboard_submissions_view",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [name, description] of Object.entries(DESCRIPTION_BY_NAME)) {
      await queryInterface.bulkUpdate(
        "user_right",
        { description, updatedAt: new Date() },
        { name },
        {}
      );
    }
  },

  async down(queryInterface) {
    for (const [name, descriptionKey] of Object.entries(DESCRIPTION_BY_NAME)) {
      const english = resolveEnText(descriptionKey);
      if (!english) {
        continue;
      }
      await queryInterface.bulkUpdate(
        "user_right",
        { description: english, updatedAt: new Date() },
        { name, description: descriptionKey },
        {}
      );
    }
  },
};
