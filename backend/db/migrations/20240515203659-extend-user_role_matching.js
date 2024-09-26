"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch users using raw SQL query
    const users = await queryInterface.sequelize.query(
      "SELECT * FROM \"user\" WHERE sysrole IN ('admin', 'regular')",
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Fetch user roles to get the mapping of role names to Ids
    const userRoles = await queryInterface.sequelize.query(
      'SELECT id, name FROM "user_role"',
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Create a mapping object of role names to Ids
    const roleNameIdMapping = userRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});

    // Transfer the data to user_role_matching table
    await queryInterface.bulkInsert(
      "user_role_matching",
      users.map((user) => {
        const getUserRole = (user) => {
          if (user.userName === "guest") {
            return "guest";
          }
          if (user.sysrole === "regular") {
            return "user";
          }
          return "admin";
        };

        return {
          userId: user.id,
          userRoleId: roleNameIdMapping[getUserRole(user)],
          deleted: user.deleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        };
      })
    );

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

    // Fetch user roles to get the mapping of Ids to role names
    const userRoles = await queryInterface.sequelize.query(
      "SELECT id, name FROM \"user_role\"",
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Create a mapping object of Ids to role names
    const idRoleNameMapping = userRoles.reduce((acc, role) => {
      acc[role.id] = role.name;
      return acc;
    }, {});

    // Fill in the sysrole column in the user table again
    const userRoleMatchings = await queryInterface.sequelize.query(
      "SELECT * FROM user_role_matching",
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    await Promise.all(
      userRoleMatchings.map((matching) =>
        queryInterface.sequelize.query(
          'UPDATE "user" SET "sysrole" = :sysrole WHERE "id" = :userId',
          {
            replacements: {
              sysrole: idRoleNameMapping[matching.userRoleId] === "user" ? "regular" : "admin",
              userId: matching.userId,
            },
            type: queryInterface.sequelize.QueryTypes.UPDATE,
          }
        )
      )
    );
  },
};
