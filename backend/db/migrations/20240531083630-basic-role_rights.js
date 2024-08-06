"use strict";

const roleRights = [
  {
    userRoleName: "teacher",
    userRightName: "backend.socket.user.getUsers.student",
  },
  {
    userRoleName: "teacher",
    userRightName: "backend.socket.user.getUsers.mentor",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "role_right_matching",
      roleRights.map((right) => {
        right["createdAt"] = new Date();
        right["updatedAt"] = new Date();
        return right;
      }),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("role_right_matching", {
      userRoleName: roleRights.map(r => r.userRoleName)
    }, {});
  },
};
