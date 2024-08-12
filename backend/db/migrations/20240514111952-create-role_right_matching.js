"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("role_right_matching", {
      userRoleName: {
        primaryKey: true,
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: "user_role",
          key: "name",
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
