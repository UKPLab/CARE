'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prompt_template', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      promptText: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      inputMapping: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      defaultOutputMapping: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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
    await queryInterface.dropTable('prompt_template');
  },
};
