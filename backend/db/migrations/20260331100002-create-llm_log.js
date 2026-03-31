'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('llm_log', {
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
          model: 'api_key',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      skillName: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('llm_log', ['userId']);
    await queryInterface.addIndex('llm_log', ['provider']);
    await queryInterface.addIndex('llm_log', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('llm_log');
  },
};
