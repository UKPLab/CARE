'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add enableEmailNotifications column to study table.
 * When true, session start and session finish emails are sent
 * using templates configured in settings (or fallback content).
 * Note: Study-closed emails use a separate setting (enableStudyCloseEmails).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('study', 'enableEmailNotifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  /**
   * Remove enableEmailNotifications column from study table.
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('study', 'enableEmailNotifications');
  },
};
