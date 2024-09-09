'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('study_workflow_step', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      studyWorkflowId: {
        type: Sequelize.INTEGER,
        references: {
          model: "study_workflow",
          key: "id"
        },
        onDelete: 'CASCADE',
        allowNull: false
      },
      stepType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      configuration: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('study_workflow_step');
  }
};
