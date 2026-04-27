'use strict';

const DESCRIPTION_BY_ROLE = {
  admin: "users.roleDescriptions.admin",
  user: "users.roleDescriptions.user",
  teacher: "users.roleDescriptions.teacher",
  mentor: "users.roleDescriptions.mentor",
  student: "users.roleDescriptions.student",
  guest: "users.roleDescriptions.guest",
  system: "users.roleDescriptions.system",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, description] of Object.entries(DESCRIPTION_BY_ROLE)) {
      await queryInterface.bulkUpdate(
        "user_role",
        { description, updatedAt: new Date() },
        { name },
        {}
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op: reverse mapping intentionally omitted.
  },
};

