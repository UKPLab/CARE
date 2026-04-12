'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trace', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      recordingId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'recording',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      direction: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      endTime: {
        type: Sequelize.DATE,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trace');
  },
};