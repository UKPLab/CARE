'use strict';

const workflowUserRights = [
  {
    name: "frontend.dashboard.workflows.view",
    description: "access to view workflows in the dashboard",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, add the user rights
    await queryInterface.bulkInsert(
      "user_right",
      workflowUserRights.map((right) => {
        right["createdAt"] = new Date();
        right["updatedAt"] = new Date();
        return right;
      }),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("user_right", {
      name: workflowUserRights.map((r) => r.name),
    }, {});
  }
};
