'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("study", "createdByUserId", {
      type: Sequelize.INTEGER,
      references: {
          model: "user", key: "id"
      }
  });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn("study", "createdByUserId");
    
  },
};
