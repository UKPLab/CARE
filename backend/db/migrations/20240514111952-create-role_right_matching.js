"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("role_right_matching", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        autoIncrement: true,
      },
      userRoleName: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: "user_role",
          key: "name",
        },
      },
      userRightName: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: "user_right",
          key: "name",
        },
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

    await queryInterface.bulkInsert("role_right_matching", [
      {
        userRoleName: "teacher",
        userRightName: "backend.socket.user.getUsers.students",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userRoleName: "teacher",
        userRightName: "backend.socket.user.getUsers.mentors",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("role_right_matching", null, {});
    await queryInterface.dropTable("role_right_matching");
  },
};
