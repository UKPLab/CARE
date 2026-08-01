'use strict';

/**
 * Align nav_element.path with frontend.dashboard.my_sessions.view.
 * Migration 20260417150912 renamed the right to my_sessions.view, but left
 * path as study_sessions. Sidebar.vue checks frontend.dashboard.${path}.view.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'nav_element',
      { path: 'my_sessions', updatedAt: new Date() },
      { path: 'study_sessions' }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'nav_element',
      { path: 'study_sessions', updatedAt: new Date() },
      { path: 'my_sessions' }
    );
  }
};
