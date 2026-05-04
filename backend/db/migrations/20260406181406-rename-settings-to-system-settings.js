'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE nav_element
      SET name = 'System Settings'
      WHERE name = 'Settings';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE nav_element
      SET name = 'Settings'
      WHERE name = 'System Settings';
    `);
  }
};
