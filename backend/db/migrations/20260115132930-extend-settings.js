'use strict';

const settings = [
    {
        key: "app.register.enabled",
        type: "boolean",
        value: "true",
        description: "Whether self-registration via the public register page is allowed."
    }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert("setting",
      settings.map(setting => {
        setting["createdAt"] = new Date();
        setting["updatedAt"] = new Date();
        return setting;
      }), {returning: true}
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
      key: settings.map(setting => setting.key)
    }, {});
  }
};
