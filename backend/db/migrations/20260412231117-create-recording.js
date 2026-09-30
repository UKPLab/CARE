'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recording', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'recording',
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      // Recordings are soft-deleted only, so a user delete must never cascade
      // them away. RESTRICT forces whoever adds user deletion to soft-delete
      // the recordings first rather than silently destroying recorded data.
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      participantSocketIds: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      excludeEvents: {
        type: Sequelize.JSONB,
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
    // publicTable is false, so getAutoTable filters these rows by userId.
    await queryInterface.addIndex('recording', ['userId'], {
      name: 'recording_userId_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('recording');
  },
};