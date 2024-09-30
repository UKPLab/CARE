"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("user", "moodleId", {
      allowNull: true,
      type: Sequelize.STRING,
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("user", "moodleId");
  },
};
