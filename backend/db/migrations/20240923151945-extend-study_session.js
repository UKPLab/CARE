'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn("study_session", "workflowStepId", {
      type: Sequelize.INTEGER,
      references: {
        model: "workflow_step",
        key: "id"
      },
      allowNull: true,
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn("study_session", "currentStep", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.removeColumn("study_session", "reviewUserId");
    await queryInterface.removeColumn("study_session", "parentStudySessionId");
    await queryInterface.removeColumn("study_session", "evaluation");
    await queryInterface.removeColumn("study_session", "comment");
    await queryInterface.removeColumn("study_session", "reviewComment");
    await queryInterface.removeColumn("study_session", "public");
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn("study_session", "reviewUserId", {
      type: Sequelize.INTEGER,
      references: {
        model: "user",
        key: "id"
      },
      allowNull: true,
    });

    await queryInterface.addColumn("study_session", "parentStudySessionId", {
      type: Sequelize.INTEGER,
      references: {
        model: "study_session",
        key: "id"
      },
      allowNull: true,
    });

    await queryInterface.addColumn("study_session", "evaluation", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("study_session", "comment", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("study_session", "reviewComment", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("study_session", "public", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.removeColumn("study_session", "workflowStepId");
    await queryInterface.removeColumn("study_session", "currentStep");
  },
};
