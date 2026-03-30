"use strict";

const settings = [
  {
    key: "logo.reBgColor",
    value: "#ffe599",
    type: "color",
    description: "Background colour for the RE section of the logo",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "setting",
      settings.map((t) => {
        t["createdAt"] = new Date();
        t["updatedAt"] = new Date();
        return t;
      }), { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
      key: settings.map((t) => t.key),
    }, {});
  },
};
