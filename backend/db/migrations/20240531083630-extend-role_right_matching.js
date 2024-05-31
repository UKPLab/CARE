"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("role_right_matching", [
      {
        userRoleName: "teacher",
        userRightName: "backend.socket.user.getUsers.students",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userRoleName: "teacher",
        userRightName: "backend.socket.user.getUsers.mentors",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("role_right_matching", null, {});
  },
};
