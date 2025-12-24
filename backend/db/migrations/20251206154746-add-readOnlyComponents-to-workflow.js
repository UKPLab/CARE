'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('workflow', 'readOnlyComponents', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('workflow', 'readOnlyComponents');
  }
};
