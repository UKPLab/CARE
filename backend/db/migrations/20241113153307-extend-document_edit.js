'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("document_edit", "text", {
      type: Sequelize.TEXT,
      allowNull: true
  });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("document_edit", "text", {
      type: Sequelize.STRING(256),
      allowNull: true
    });
  },
};
