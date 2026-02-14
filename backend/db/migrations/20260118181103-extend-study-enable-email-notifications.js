'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add email notification columns to the study table.
 * - enableEmailNotifications: controls session start/finish emails.
 * - enableStudyCloseEmails: controls study-closed emails.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('study', 'enableEmailNotifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('study', 'enableStudyCloseEmails', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('study', 'enableStudyCloseEmails');
    await queryInterface.removeColumn('study', 'enableEmailNotifications');
  },
};
