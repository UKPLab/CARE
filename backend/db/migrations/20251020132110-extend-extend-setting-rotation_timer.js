'use strict';

const settings = [
    {
        key: "modal.nlp.rotation_timer.short",
        value: 30000,
        type: "integer",
        description: "Short rotation timer duration in milliseconds."
    },
    {
        key: "modal.nlp.rotation_timer.long",
        value: 120000,
        type: "integer", 
        description: "Long rotation timer duration in milliseconds."
    }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('setting',
        settings.map(t => {
            t['createdAt'] = new Date();
            t['updatedAt'] = new Date();
            return t;
        }), {returning: true});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
        key: settings.map(t => t.key)
    }, {});
  }
};
