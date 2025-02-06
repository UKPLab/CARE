"use strict";

const settings = [
  {
    key: "app.config.consent.enabled",
    value: "true",
    type: "boolean",
    description: "Enable consent updating feature",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const groups = await queryInterface.bulkInsert(
      "setting",
      settings.map((t) => {
        t["createdAt"] = new Date();
        t["updatedAt"] = new Date();
        return t;
      }), { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    //delete nav elements first
    await queryInterface.bulkDelete("setting", {
        key: settings.map((t) => t.key),
      }, {});
  },
};
