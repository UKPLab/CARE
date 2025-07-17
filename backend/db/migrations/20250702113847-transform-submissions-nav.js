"use strict";

const oldNavElement = {
  name: "Review Documents",
  groupId: "Admin",
  icon: "file-earmark-richtext",
  order: 9,
  admin: true,
  path: "review_documents",
  component: "ReviewDocuments",
};

const newNavElement = {
  ...oldNavElement,
  name: "Submissions",
  path: "submissions",
  component: "Submissions",
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "nav_element",
      { name: oldNavElement.name },
      {}
    );

    const groupId = await queryInterface.rawSelect(
      "nav_group",
      { where: { name: newNavElement.groupId } },
      ["id"]
    );
    await queryInterface.bulkInsert(
      "nav_element",
      [
        {
          ...newNavElement,
          groupId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "nav_element",
      { name: newNavElement.name },
      {}
    );

    const groupId = await queryInterface.rawSelect(
      "nav_group",
      { where: { name: oldNavElement.groupId } },
      ["id"]
    );
    await queryInterface.bulkInsert(
      "nav_element",
      [
        {
          ...oldNavElement,
          groupId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },
};