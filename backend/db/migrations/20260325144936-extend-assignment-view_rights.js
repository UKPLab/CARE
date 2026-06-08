'use strict';

const assignmentViewRights = [
  {
    name: "frontend.dashboard.assignments.view",
    description: "access to view assignments in the dashboard",
  },
];

const roleRights = [
  { role: "teacher", userRightName: "frontend.dashboard.assignments.view" },
  { role: "mentor", userRightName: "frontend.dashboard.assignments.view" },
  { role: "admin", userRightName: "frontend.dashboard.assignments.view" },
  { role: "user", userRightName: "frontend.dashboard.assignments.view" },
  { role: "guest", userRightName: "frontend.dashboard.assignments.view" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "user_right",
      assignmentViewRights.map((right) => ({
        ...right,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );

    const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    const roleNameIdMapping = userRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});

    await queryInterface.bulkInsert(
      "role_right_matching",
      roleRights
        .filter((right) => roleNameIdMapping[right.role])
        .map((right) => ({
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
      {
        userRightName: roleRights.map((r) => r.userRightName),
      },
      {}
    );

    await queryInterface.bulkDelete(
      "user_right",
      {
        name: assignmentViewRights.map((r) => r.name),
      },
      {}
    );
  }
};
