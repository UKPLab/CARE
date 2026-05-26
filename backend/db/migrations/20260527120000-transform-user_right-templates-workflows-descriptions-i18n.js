'use strict';

const { resolveEnText } = require('../migration-i18n-utils');

/** Rights added after 20260302143000; descriptions were still plain English. */
const DESCRIPTION_BY_NAME = {
  "frontend.dashboard.templates.view": "users.rightDescriptions.frontend_dashboard_templates_view",
  "frontend.dashboard.workflows.view": "users.rightDescriptions.frontend_dashboard_workflows_view",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
        'user_right',
        { description: english, updatedAt: new Date() },
        { name },
        {}
      );
    }
  },
};
