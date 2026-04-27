'use strict';

const DESCRIPTION_BY_NAME = {
  "backend.socket.user.getUsers.student": "users.rightDescriptions.backend_socket_user_getUsers_student",
  "backend.socket.user.getUsers.mentor": "users.rightDescriptions.backend_socket_user_getUsers_mentor",
  "frontend.dashboard.users.view": "users.rightDescriptions.frontend_dashboard_users_view",
  "backend.socket.user.getUsers.all": "users.rightDescriptions.backend_socket_user_getUsers_all",
  "frontend.dashboard.studies.addBulkAssignments": "users.rightDescriptions.frontend_dashboard_studies_addBulkAssignments",
  "frontend.dashboard.studies.addSingleAssignments": "users.rightDescriptions.frontend_dashboard_studies_addSingleAssignments",
  "frontend.dashboard.studies.fullAccess": "users.rightDescriptions.frontend_dashboard_studies_fullAccess",
  "frontend.dashboard.studies.view.readOnly": "users.rightDescriptions.frontend_dashboard_studies_view_readOnly",
  "frontend.dashboard.studies.view.userPrivateInfo": "users.rightDescriptions.frontend_dashboard_studies_view_userPrivateInfo",
  "frontend.dashboard.home.view": "users.rightDescriptions.frontend_dashboard_home_view",
  "frontend.dashboard.documents.view": "users.rightDescriptions.frontend_dashboard_documents_view",
  "frontend.dashboard.tags.view": "users.rightDescriptions.frontend_dashboard_tags_view",
  "frontend.dashboard.projects.view": "users.rightDescriptions.frontend_dashboard_projects_view",
  "frontend.dashboard.studies.view": "users.rightDescriptions.frontend_dashboard_studies_view",
  "frontend.dashboard.study_sessions.view": "users.rightDescriptions.frontend_dashboard_study_sessions_view",
  "study.template.delete": "users.rightDescriptions.study_template_delete",
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
    // Intentionally left as no-op because original free-text values were not uniquely preserved.
  },
};

