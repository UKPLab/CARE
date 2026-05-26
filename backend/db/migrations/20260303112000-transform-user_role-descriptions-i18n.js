'use strict';

const { resolveEnText } = require('../migration-i18n-utils');

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

  async down(queryInterface) {
    for (const [name, descriptionKey] of Object.entries(DESCRIPTION_BY_ROLE)) {
      const english = resolveEnText(descriptionKey);
      if (!english) {
        continue;
      }
      await queryInterface.bulkUpdate(
        'user_role',
        { description: english, updatedAt: new Date() },
        { name },
        {}
      );
    }
  },
};

