'use strict';

const assignmentAdminRights = [
  {
    name: "frontend.dashboard.assignments.viewAll",
    description: "access to view all assignments and submissions in the Assignments dashboard view",
  },
  {
    name: "frontend.dashboard.assignments.uploadForOthers",
    description: "access to upload submissions for other users",
  },
  {
    name: "frontend.dashboard.assignments.edit",
    description: "access to edit assignments",
  },
  {
    name: "frontend.dashboard.assignments.replaceDeleteSubmissions",
    description: "access to replace or delete submissions",
  },
  {
    name: "frontend.dashboard.submissions.view",
    description: "access to view submissions dashboard",
  },
];

const roleRights = [
  { role: "admin", userRightName: "frontend.dashboard.assignments.viewAll" },
  { role: "admin", userRightName: "frontend.dashboard.assignments.uploadForOthers" },
  { role: "admin", userRightName: "frontend.dashboard.assignments.edit" },
  { role: "admin", userRightName: "frontend.dashboard.assignments.replaceDeleteSubmissions" },
  { role: "user", userRightName: "frontend.dashboard.submissions.view" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "user_right",
      assignmentAdminRights.map((right) => ({
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

  async down(queryInterface, Sequelize) {
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
        name: assignmentAdminRights.map((r) => r.name),
      },
      {}
    );
  },
};
