"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tag_set", "projectId", {
      type: Sequelize.INTEGER,
      defaultValue: 1,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("tag_set", "projectId");
  },
};