"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("study", "studyWorkflowId", {
      type: Sequelize.INTEGER,
      references: {
          model: "study_workflow",
          key: "id"
      },
      allowNull: true,  
      onDelete: 'SET NULL' 
    });

    await queryInterface.addColumn("study", "allowNavigation", {
      type: Sequelize.BOOLEAN,
      allowNull: false,  
      defaultValue: false,  
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("study", "studyWorkflowId");
    await queryInterface.removeColumn("study", "allowNavigation");
  },
};