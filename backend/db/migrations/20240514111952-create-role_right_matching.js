'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('role_right_matching', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userRoleId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'user_role',
          key: 'id'
        },
      },
      userRightName: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'user_right',
          key: 'name'
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
    await queryInterface.dropTable('role_right_matching');
  },
};
