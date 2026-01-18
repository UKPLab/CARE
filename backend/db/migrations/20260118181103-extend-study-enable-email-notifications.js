'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add enableEmailNotifications column to study table.
 * When true, session start, session finish, and study-closed emails are sent
 * using templates configured in settings (or fallback content).
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
