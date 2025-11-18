'use strict';

const userRights = [
  {
    name: "study.template.delete",
    description: "access to delete templates",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "user_right",
      userRights.map((right) => {
        right["createdAt"] = new Date();
        right["updatedAt"] = new Date();
        return right;
      }),
      {}
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("user_right", {
        name: userRights.map((r) => r.name),
      }, {});
  }
};
