"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("role_right_matching", {
      userRoleId: {
        // Sets both userRoleId and userRightName as primaryKey to avoid repeated role right assignment.
        primaryKey: true,
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: "user_role",
          key: "id", 
        },
      },
      userRightName: {
        primaryKey: true,
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("role_right_matching");
  },
};
