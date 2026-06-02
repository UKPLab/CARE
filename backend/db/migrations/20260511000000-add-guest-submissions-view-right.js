'use strict';

const RIGHT_NAME = "frontend.dashboard.submissions.view";
const ROLE_NAME = "guest";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    const guestRole = userRoles.find((role) => role.name === ROLE_NAME);
    if (!guestRole) {
      return;
    }

    await queryInterface.bulkInsert(
      "role_right_matching",
      [
        {
          userRoleId: guestRole.id,
          userRightName: RIGHT_NAME,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    const guestRole = userRoles.find((role) => role.name === ROLE_NAME);
    if (!guestRole) {
      return;
    }

    await queryInterface.bulkDelete(
      "role_right_matching",
      {
        userRoleId: guestRole.id,
        userRightName: RIGHT_NAME,
      },
      {}
    );
  },
};
