'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comment_state', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      documentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'document',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        }
      },
      studySessionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'study_session',
          key: 'id'
        }
      },
      studyStepId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'study_step',
          key: 'id'
        }
      },
      commentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'comment',
          key: 'id'
        }
      },
      state: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable('comment_state');
  }
};