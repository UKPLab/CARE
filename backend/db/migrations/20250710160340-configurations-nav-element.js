"use strict";

const navElements = [
  {
    name: "Configurations",
    groupId: "Admin",
    icon: "clipboard-check",
    order: 15,
    admin: false,
    path: "configurations",
    component: "Configurations",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "nav_element",
      await Promise.all(
        navElements.map(async (t) => {
          const groupId = await queryInterface.rawSelect(
            "nav_group",
            {
              where: { name: t.groupId },
            },
            ["id"]
          );

          t["createdAt"] = new Date();
          t["updatedAt"] = new Date();
          t["groupId"] = groupId;

          return t;
        })
      ),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("nav_element", {
      name: navElements.map((t) => t.name),
    });
  },
};
