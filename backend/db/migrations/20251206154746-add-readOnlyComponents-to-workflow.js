'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column already exists before adding
    const tableDescription = await queryInterface.describeTable('workflow');
    
    if (!tableDescription.readOnlyComponents) {
      await queryInterface.addColumn('workflow', 'readOnlyComponents', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('workflow', 'readOnlyComponents');
  }
};
