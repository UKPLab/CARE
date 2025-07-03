'use strict';

module.exports = {
  /**
   * Run the migration – create the "submission" table
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('submission', {
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
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      projectId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'project',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      parentSubmissionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'submission',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      extSubmissionId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      group: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      additionalSettings: {
        type: Sequelize.JSONB,
        allowNull: true,
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

  /**
   * Revert: simply drop the table (dev only).
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('submission');
  },
};