"use strict";

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('document_edit', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0, 
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('document_edit', 'order');
  }
};
