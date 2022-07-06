'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('annotations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      creator: {
        type: Sequelize.STRING
      },
      text: {
        type: Sequelize.STRING
      },
      tags: {
        type: Sequelize.STRING
      },
      shared: {
        type: Sequelize.BOOLEAN
      },
      document: {
        type: Sequelize.STRING
      },
      selectors: {
        type: Sequelize.JSONB
      },
      references: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('annotations');
  }
};