'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assignment_share', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      assignmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'assignment',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'user_role',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'user',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });


    await queryInterface.addIndex('assignment_share', ['assignmentId'], {
      name: 'assignment_share_assignmentId_index',
    });

    await queryInterface.sequelize.query(
      `ALTER TABLE "assignment_share" ADD CONSTRAINT "chk_assignment_share_exclusive"
       CHECK (
         ("roleId" IS NOT NULL AND "userId" IS NULL) OR
         ("userId" IS NOT NULL AND "roleId" IS NULL)
       )`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('assignment_share');
  },
};
