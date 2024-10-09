"use strict";

const navElements = [
  {
    name: "Moodle Submission",
    groupId: "Admin",
    icon: "file-earmark-richtext",
    order: 9,
    admin: true,
    path: "moodle_submission",
    component: "MoodleSubmission",
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
