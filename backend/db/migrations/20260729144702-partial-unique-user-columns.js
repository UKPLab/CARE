"use strict";

const {addPartialUniqueIndexes, removePartialUniqueIndexes} = require("../../utils/helper/softDeleteUniqueIndex.js");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await addPartialUniqueIndexes(queryInterface, "user", transaction);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await removePartialUniqueIndexes(queryInterface, "user", transaction);
    });
  },
};
