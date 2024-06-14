"use strict";

const userRights = [
  {
    name: "backend.socket.user.getUsers.student",
    description: "access to get all students",
  },
  {
    name: "backend.socket.user.getUsers.mentor",
    description: "access to get all mentors",
  },
  {
    name: "frontend.dashboard.users.view",
    description: "access to view users on the dashboard",
  },
  // TODO: The following right hasn't been assigned to any role in the 'role_right_matching' table 
  {
    name: "backend.socket.user.getUsers.all",
    description: "access to get all users",
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
