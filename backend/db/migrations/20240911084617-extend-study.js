'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("study", "workflowId", {
      type: Sequelize.INTEGER,
      references: {
          model: "workflow",
          key: "id"
      },
      allowNull: true,  
      onDelete: 'SET NULL' 
    });

    await queryInterface.addColumn("study", "multipleSubmit", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("study", "limitSessions", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("study", "limitSessionsPerUser", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("study", "closed", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn("study", "userIdClosed", {
      type: Sequelize.INTEGER,
      references: {
        model: "user",
        key: "id"
      },
      allowNull: true,
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn("study", "template", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.removeColumn("study", "documentId");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("study", "documentId", {
      type: Sequelize.INTEGER,
      references: {
        model: "document",
        key: "id"
      },
      allowNull: true,
    });

    await queryInterface.removeColumn("study", "workflowId");
    await queryInterface.removeColumn("study", "multipleSubmit");
    await queryInterface.removeColumn("study", "limitSessions");
    await queryInterface.removeColumn("study", "limitSessionsPerUser");
    await queryInterface.removeColumn("study", "closed");
    await queryInterface.removeColumn("study", "userIdClosed");
    await queryInterface.removeColumn("study", "template");
  },
};