'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add enableStudyCloseEmails column to study table.
 * When true, study close emails are sent to users with open/unfinished sessions
 * using templates configured in settings (Type 6: Email - Study Close) or fallback content.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('study', 'enableStudyCloseEmails', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  /**
   * Remove enableStudyCloseEmails column from study table.
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('study', 'enableStudyCloseEmails');
  },
};
