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
      aiModelId: {
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
      requestId: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      input: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      output: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reasoning: {
        type: Sequelize.TEXT,
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
      reasoningTokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      total_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      costs: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'success',
      },
      requestStart: {
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
    await queryInterface.dropTable('ai_log');
  },
};
