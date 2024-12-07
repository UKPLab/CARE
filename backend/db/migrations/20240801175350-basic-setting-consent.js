"use strict";

const settings = [
  {
    key: "app.register.acceptStats.default",
    value: false,
    type: "boolean",
    description: "The default value of whether the user agrees to tracking during registration.",
  },
  {
    key: "app.register.requestData",
    value: true,
    type: "boolean",
    description: "Indicates if the option for data sharing during registration is enabled.",
  },
  {
    key: "app.register.acceptDataSharing.default",
    value: false,
    type: "boolean",
    description: "The default value of whether the user agrees to share data during registration.",
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
      }),
      { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    //delete nav elements first
    await queryInterface.bulkDelete("setting", {
        key: settings.map((t) => t.key),
      },{});
  },
};
