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
      // SET NULL would leave the recording intact but silently unreplayable
      // (groupTracesBySocket skips traces with no userId). RESTRICT keeps trace
      // ownership honest; recordings are soft-deleted, never orphaned.
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      socketId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      // true = frontend -> backend (onAny), false = backend -> frontend (onAnyOutgoing)
      direction: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: false,
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

    // Every trace lookup filters by recordingId (getTraces, buildSessionPool,
    // stopRecording), so that's the index that matters.
    await queryInterface.addIndex('trace', ['recordingId'], {
      name: 'trace_recordingId_idx',
    });

    await queryInterface.addIndex('trace', ['socketId'], {
      name: 'trace_socketId_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trace');
  },
};