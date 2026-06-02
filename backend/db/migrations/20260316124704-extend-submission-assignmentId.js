'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('submission', 'assignmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'assignment',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('submission', 'assignmentId');
  }
};
