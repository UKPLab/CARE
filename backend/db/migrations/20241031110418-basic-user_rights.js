"use strict";

const userRights = [
  {
    name: "frontend.dashboard.studies.addBulkAssignments",
    description: "access to the functionality of bulk adding assignments on the dashboard",
  },
  {
    name: "frontend.dashboard.studies.addSingleAssignments",
    description: "access to the functionality of adding assignments on the dashboard",
  },
  {
    name: "frontend.dashboard.studies.view",
    description: "access to view open studies and sessions",
  },
  {
    name: "frontend.dashboard.studies.view.readOnly",
    description: "access to open sessions in a read-only mode",
  },
  {
    name: "frontend.dashboard.studies.view.userPrivateInfo",
    description: "access to view user's private information such as first name and last name",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
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

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("user_right", {
        name: userRights.map((r) => r.name),
      }, {});
  },
};
