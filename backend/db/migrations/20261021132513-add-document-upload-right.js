"use strict";

const RIGHT_NAME = "frontend.dashboard.documents.upload";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      await queryInterface.bulkInsert("user_right", [{
        name: RIGHT_NAME,
        description: "access to upload documents from the Documents page and Home dashboard",
        createdAt: now,
        updatedAt: now,
      }], {transaction});

      // Preserve upload access for existing roles, including custom roles.
      // Administrators can remove the right through Rights Management.
      const roles = await queryInterface.sequelize.query('SELECT id FROM "user_role" WHERE deleted = false', {
        type: Sequelize.QueryTypes.SELECT,
        transaction,
      });
      if (roles.length > 0) {
        await queryInterface.bulkInsert("role_right_matching", roles.map((role) => ({
          userRoleId: role.id,
          userRightName: RIGHT_NAME,
          createdAt: now,
          updatedAt: now,
        })), {transaction});
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("role_right_matching", {userRightName: RIGHT_NAME}, {transaction});
      await queryInterface.bulkDelete("user_right", {name: RIGHT_NAME}, {transaction});
    });
  },
};
