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
      // TODO: onDelete CASCADE hard-deletes a user's recordings, bypassing the
      // soft-delete rule the rest of CARE follows. trace.userId uses SET NULL
      // instead, which silently makes a recording unreplayable. Both need a
      // decision on what deleting a user should do to recorded data.
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