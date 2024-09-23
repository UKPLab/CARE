'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('study_step', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      studyId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'study',
          key: 'id'
        },
        onDelete: 'CASCADE',
        allowNull: false
      },
      workflowStepId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'workflow_step',
          key: 'id'
        },
        onDelete: 'CASCADE',
        allowNull: false
      },
      documentId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'document',
          key: 'id'
        },
        onDelete: 'SET NULL',
        allowNull: true
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('study_step');
  }
};
