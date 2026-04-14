'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('study_session', 'parentStudySessionId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'study_session',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('study_session', 'parentStudySessionId');
  }
};
