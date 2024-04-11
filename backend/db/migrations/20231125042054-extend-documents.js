'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'document',
      'type',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0, // Default is 0 for pdf
      }
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('document', "type");
  }
};
