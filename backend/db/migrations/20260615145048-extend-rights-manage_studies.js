'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "user_right",
      [
      {
        name: "frontend.dashboard.studies.canManageStudies",
        description: "access to manage studies in the dashboard, including bulk closing and deleting studies",
        createdAt: new Date(),
        updatedAt: new Date(),    
      }
    ],
      {}
    );

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
      [
        {
          userRoleId: roleNameIdMapping["admin"],
          userRightName: "frontend.dashboard.studies.canManageStudies",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ],
      {}
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("user_right", {
        name: "frontend.dashboard.studies.canManageStudies",
      }, {});

    await queryInterface.bulkDelete("role_right_matching", {
        userRightName: "frontend.dashboard.studies.canManageStudies",
      }, {});

    
  }
};