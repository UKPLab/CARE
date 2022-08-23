'use strict';

const baseTags = [
    ["Highlight", "warning"],
    ["Strength", "success"],
    ["Weakness", "danger"],
    ["Other", "info"],
];

module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert("tag",
            baseTags.map(t => {
                return {
                    name: t[0],
                    description: t[0],
                    colorCode: t[1],
                    updatedAt: new Date(),
                    createdAt: new Date(),
                    deleted: false
                };
            }),
        {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("tag", {
            name: baseTags.map(t => t[0])
        }, {});
  }
};
