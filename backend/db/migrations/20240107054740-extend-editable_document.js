"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("editable_document", "version", {
      type: Sequelize.STRING,
      defaultValue: 0,
      allowNull: false
    });
    await queryInterface.addColumn("editable_document", "docHash", {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: "document",
        key: "hash"
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("editable_document", "version");
  }
};
