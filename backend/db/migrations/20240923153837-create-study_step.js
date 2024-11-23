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
      studyStepPrevious:{
      type: Sequelize.INTEGER,
        references: {
          model: 'study_step',
          key: 'id'
        },
        allowNull: true,
        onDelete: 'SET NULL'
      },
      stepType: {
        type: Sequelize.INTEGER,
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
      },
      configuration: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      },
      deleted: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
      },
      createdAt: {
          allowNull: false,
          type: Sequelize.DATE
      },
      updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
      },
      deletedAt: {
          allowNull: true,
          defaultValue: null,
          type: Sequelize.DATE
      },
      allowBackward: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      workflowStepDocument: {
        type: Sequelize.INTEGER,
        references: {
          model: 'study_step',
          key: 'id'
        },
        allowNull: true,
        onDelete: 'SET NULL'
      },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('study_step');
  }
};
