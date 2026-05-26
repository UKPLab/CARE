'use strict';

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

  async down(queryInterface, Sequelize) {
    // No-op: previous English strings not restored.
  },
};
