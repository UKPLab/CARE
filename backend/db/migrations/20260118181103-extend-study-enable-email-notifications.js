'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add enableEmailNotifications column to the study table.
 * Controls session start/finish emails.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('study', 'enableEmailNotifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('study', 'enableEmailNotifications');
  },
};
