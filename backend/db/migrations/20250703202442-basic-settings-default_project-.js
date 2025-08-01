'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('setting', [
      {
        key: "projects.default",
        value: "1",
        description: "The default project to use for new documents or studies",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('setting', {
      key: "projects.default"
    }, {});
  }
};