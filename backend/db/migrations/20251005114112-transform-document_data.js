'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addIndex('document_data', {
      fields: ['documentId', 'studySessionId', 'studyStepId', 'key'],
      unique: true,
      name: 'document_data_composite_unique_key',
      where: {
        deleted: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('document_data', 'document_data_composite_unique_key');
  }
};