'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workflow_step', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      workflowId: {
        type: Sequelize.INTEGER,
        references: {
          model: "workflow",
          key: "id"
        },
        onDelete: 'CASCADE',
        allowNull: false
      },
      stepType: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      workflowStepPrevious: {
        type: Sequelize.INTEGER,
        references: {
          model: 'workflow_step',
          key: 'id'
        },
        allowNull: true, 
        onDelete: 'SET NULL'
      },
      allowBackward: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      workflowStepDocument: {
        type: Sequelize.INTEGER,
        references: {
          model: 'workflow_step',
          key: 'id'
        },
        allowNull: true,
        onDelete: 'SET NULL'
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
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('workflow_step');
  }
};
