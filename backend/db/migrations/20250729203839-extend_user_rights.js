'use strict';

const userRights = [
  {
    name: "frontend.dashboard.home.view",
    description: "access to view home in the dashboard",
  },
  {
    name: "frontend.dashboard.documents.view",
    description: "access to view documents in the dashboard",
  },
  {
    name: "frontend.dashboard.tags.view",
    description: "access to view tagsets in the dashboard",
  },
  {
    name: "frontend.dashboard.projects.view",
    description: "access to view projects in the dashboard",
  },
  {
    name: "frontend.dashboard.studies.view",
    description: "access to view studies in the dashboard",
  },
  {
    name: "frontend.dashboard.study_sessions.view",
    description: "access to view study sessions in the dashboard",
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
