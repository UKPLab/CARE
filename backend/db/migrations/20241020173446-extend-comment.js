'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('comment', 'studyStepId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'study_step',
        key: 'id'
      },
      allowNull: true, 
      onDelete: 'SET NULL', 
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('comment', 'studyStepId');
  }
};
