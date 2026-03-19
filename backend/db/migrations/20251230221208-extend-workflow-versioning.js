'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add parentWorkflowId and hideInFrontend columns to workflow table
    await queryInterface.addColumn('workflow', 'parentWorkflowId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'workflow',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('workflow', 'hideInFrontend', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('workflow', 'parentWorkflowId');
    await queryInterface.removeColumn('workflow', 'hideInFrontend');
  }
};