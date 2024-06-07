"use strict";

const userRights = [
  {
    name: "backend.socket.user.getUsers.students",
    description: "access to get all student users",
  },
  {
    name: "backend.socket.user.getUsers.mentors",
    description: "access to get all student mentors",
  },
  {
    name: "frontend.dashboard.users.view",
    description: "access to view users on the dashboard",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert rights into the user_right table
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
    await queryInterface.bulkDelete("user_right", null, {});
  },
};
