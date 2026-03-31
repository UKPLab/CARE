'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('api_key', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      apiEndpoint: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      encryptedKey: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      shared: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sharedScope: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'none',
      },
      sharedTargetId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      usageLimitMonthly: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('api_key');
  },
};
