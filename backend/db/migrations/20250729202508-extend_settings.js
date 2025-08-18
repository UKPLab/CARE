'use strict';

const settings = [
    {
        key: "topBar.projects.hideProjectButton",
        type: "boolean",
        value: "false",
        description: "Whether to hide the project button in the topBar"
    }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('setting',
      settings.map(setting => {
        setting['createdAt'] = new Date();
        setting['updatedAt'] = new Date();
        return setting;
      }), {}
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
      key: settings.map(setting => setting.key)
    }, {});
  }
};
