"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch all users using raw SQL query
    const users = await queryInterface.sequelize.query(
      'SELECT * FROM "user" WHERE sysrole IN (:sysroles)',
      {
        replacements: { sysroles: ["admin"] },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Transfer the data to user_role_matching table
    for (const user of users) {
      await queryInterface.bulkInsert("user_role_matching", [
        {
          userId: user.id,
          userRoleName: user.sysrole,
          deleted: user.deleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        },
      ]);
    }

    // Remove the sysrole column from the user table
    await queryInterface.removeColumn("user", "sysrole");
  },

  async down(queryInterface, Sequelize) {
    // Add back the sysrole column to the user table
    await queryInterface.addColumn("user", "sysrole", {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: "sysrole",
        key: "name",
      },
    });

    // Fill in the sysrole column in the user table again
    const userRoleMatchings = await queryInterface.sequelize.query(
      "SELECT * FROM user_role_matching",
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    for (const matching of userRoleMatchings) {
      await queryInterface.sequelize.query(
        'UPDATE "user" SET "sysrole" = :userRoleName WHERE "id" = :userId',
        {
          replacements: {
            userRoleName: matching.userRoleName,
            userId: matching.userId,
          },
          type: queryInterface.sequelize.QueryTypes.UPDATE,
        }
      );
    }
  },
};
