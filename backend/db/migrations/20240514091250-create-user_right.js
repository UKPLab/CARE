"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_right", {
      id: {
        allowNull: false,
        autoIncrement: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.STRING(512),
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        allowNull: true,
        defaultValue: null,
        type: Sequelize.DATE,
      },
    });

    // TODO: Check if there are other rights to be inserted
    // Insert rights into the user_right table
    await queryInterface.bulkInsert("user_right", [
      {
        name: "backend.socket.user.getUsers.students",
        description: "access to get all student users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "backend.socket.user.getUsers.mentors",
        description: "access to get all student mentors",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "frontend.dashboard.users.view",
        description: "access to view users on the dashboard",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },
  async down(queryInterface, Sequelize) {
    // Delete all rows in the user_right table
    await queryInterface.bulkDelete("user_right", null, {});
    await queryInterface.dropTable("user_right");
  },
};
