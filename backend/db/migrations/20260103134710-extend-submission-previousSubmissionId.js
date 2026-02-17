'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('submission', 'previousSubmissionId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'submission',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('submission', 'previousSubmissionId');
  }
};
