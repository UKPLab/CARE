'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_log', {
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
      apiKeyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'ai_api_key',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      modelId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ai_model',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      documentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      studySessionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      studyStepId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      input: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      output: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      inputTokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      outputTokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      estimatedCost: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      latencyMs: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'success',
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
    await queryInterface.dropTable('ai_log');
  },
};
