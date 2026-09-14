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
        allowNull: true,
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
        references: {
          model: 'document',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      studySessionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'study_session',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      studyStepId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'study_step',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
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
        allowNull: true,
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

    // Inflight check, model spend sums, share attribution, session spend, abort by requestId.
    await queryInterface.addIndex('ai_log', ['userId', 'studySessionId', 'status', 'createdAt'], {
      name: 'ai_log_userId_studySessionId_status_createdAt_index',
    });
    await queryInterface.addIndex('ai_log', ['aiModelId', 'status', 'createdAt'], {
      name: 'ai_log_aiModelId_status_createdAt_index',
    });
    await queryInterface.addIndex('ai_log', ['aiModelId', 'userId', 'status', 'createdAt'], {
      name: 'ai_log_aiModelId_userId_status_createdAt_index',
    });
    await queryInterface.addIndex('ai_log', ['studySessionId', 'status', 'createdAt'], {
      name: 'ai_log_studySessionId_status_createdAt_index',
    });
    await queryInterface.addIndex('ai_log', ['requestId'], {
      name: 'ai_log_requestId_index',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ai_log');
  },
};
