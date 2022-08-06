'use strict';

const baseTags = [
    "Strength",
    "Weakness",
    "Question",
    "Todo",
    "Highlight"
] ;

module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert("tag",
            baseTags.map(t => {
                return {
                    name: t,
                    description: t,
                    updatedAt: new Date(),
                    createdAt: new Date(),
                    deleted: false
                };
            }),
        {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("tag", {
            name: baseTags
        }, {});
  }
};
