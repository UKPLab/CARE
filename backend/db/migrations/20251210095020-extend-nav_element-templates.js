'use strict';

const navElements=[
  {
    name: "Templates",
    groupId: "Default",
    icon: "file-earmark-ruled",
    order: 14,
    admin: false,
    path: "templates",
    component: "Templates",
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
        }),
        {}
      )
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "nav_element",
      {
        name: navElements.map((t) => t.name),
      },
      {}
    );
  }
};
