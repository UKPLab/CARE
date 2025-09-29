'use strict';

const roleRights = [
  {
    role: "guest",
    userRightName: "frontend.dashboard.documents.view",
  },
  {
    role: "guest",
    userRightName: "frontend.dashboard.tags.view",
  },
  {
    role: "guest",
    userRightName: "frontend.dashboard.projects.view",
  },
  {
    role: "guest",
    userRightName: "frontend.dashboard.study_sessions.view",
  },
  {
    role: "guest",
    userRightName: "frontend.dashboard.studies.view",
  }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    // Create a mapping object of role names to Ids
    const roleNameIdMapping = userRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});

    await queryInterface.bulkInsert(
      "role_right_matching",
      roleRights.map((right) => ({
        userRoleId: roleNameIdMapping[right.role],
        userRightName: right.userRightName,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "role_right_matching",
      { userRightName: roleRights.map((r) => r.userRightName) },
      {}
    );
  }
};
