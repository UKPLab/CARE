"use strict";

const { Op } = require("sequelize");

/**
 * This migration transfers the existing roles ("regular" and "admin") from 'sysrole' table 
 * to 'user_role' table and inserts new roles to 'user_role' table.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch two rows from sysrole table where the names are regular and admin
    const selectedSysroles = await queryInterface.sequelize.query(
      "SELECT * FROM sysrole WHERE name IN (:names)",
      {
        replacements: { names: ["regular", "admin"] },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    await queryInterface.bulkInsert(
      "user_role",
      await Promise.all(
        selectedSysroles.map(async (sysrole) => {
          return {
            name: sysrole.name,
            description: sysrole.description,
            deleted: sysrole.deleted,
            createdAt: sysrole.createdAt,
            updatedAt: sysrole.updatedAt,
            deletedAt: sysrole.deletedAt,
          };
        })
      )
    );

    await queryInterface.bulkInsert("user_role", [
      {
        name: "teacher",
        description: "responsible for coordination",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "mentor",
        description: "have the grading right.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "student",
        description: "leave inline commentary",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("user_role", {
      name: { [Op.in]: ["regular", "admin", "teacher", "mentor", "student"] },
    });
  },
};
