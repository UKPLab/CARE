'use strict';

const settings = [
    {
        key: "annotator.comments.defaultNumsShown.levelZero",
        value: 3,
        type: "integer",
        description: "How many 0-level comments are shown by default when annotation responses are shown"
    },
    {
        key: "annotator.comments.defaultNumsShown.levelOneUp",
        value: 1,
        type: "integer", 
        description: "How many 1st or higher level comments are shown by default."
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
