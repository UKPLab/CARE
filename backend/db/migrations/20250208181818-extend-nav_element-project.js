"use strict";

const navElements = [
  {
    name: "Projects",
    groupId: "Default",
    icon: "inboxes-fill",
    order: 13,
    admin: true, // TODO change to false (only for EiwA true)
    path: "projects",
    component: "Projects",
  },
];

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
        }),
        {}
      )
    );
  },

  async down(queryInterface, Sequelize) {
    //delete nav elements first
    await queryInterface.bulkDelete(
      "nav_element",
      {
        name: navElements.map((t) => t.name),
      },
      {}
    );
  },
};
