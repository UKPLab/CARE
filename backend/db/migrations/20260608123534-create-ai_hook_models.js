'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_hook_models', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      aiHookId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ai_hook',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      aiModelId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ai_model',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      additionalParameters: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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
    await queryInterface.addIndex('ai_hook_models', ['aiHookId', 'priority'], {
      unique: true,
      where: { deleted: false },
      name: 'ai_hook_models_active_priority_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ai_hook_models');
  },
};
