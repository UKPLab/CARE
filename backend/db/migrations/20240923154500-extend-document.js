'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('document', 'parentDocumentId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'document',
        key: 'id'
      },
      allowNull: true, 
      onDelete: 'SET NULL', 
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('document', 'parentDocumentId');
  }
};
