'use strict';

const settings = [{
    key: "statistics.tracking",
    value: "false",
    type: "boolean",
    description: "Enable or disable behavior tracking"
}];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
            t["createdAt"] = new Date();
            t["updatedAt"] = new Date();
            return t;
        }), {returning: true});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});

    }
};
