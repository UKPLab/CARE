"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const defaultGroupId = await queryInterface.rawSelect(
      "nav_group",
      { where: { name: "Default" } },
      ["id"]
    );

    await queryInterface.bulkUpdate(
      "nav_element",
      {
        groupId: defaultGroupId,
        admin: false,
        updatedAt: new Date(),
      },
      {
        path: "submissions",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    const adminGroupId = await queryInterface.rawSelect(
      "nav_group",
      { where: { name: "Admin" } },
      ["id"]
    );

    await queryInterface.bulkUpdate(
      "nav_element",
      {
        groupId: adminGroupId,
        admin: true,
        updatedAt: new Date(),
      },
      {
        path: "submissions",
      }
    );
  },
};
