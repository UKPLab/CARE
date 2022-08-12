'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tag', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        unique: true
      },
      description: {
        type: Sequelize.STRING(512)
      },
      colorCode: {
        type: Sequelize.STRING,
        allowNull: true
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
    await queryInterface.dropTable('tag');
  }
};