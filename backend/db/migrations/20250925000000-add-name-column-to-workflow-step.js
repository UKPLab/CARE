'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('workflow_step', 'name', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: ""
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('workflow_step', 'name');
  }
};