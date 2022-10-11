'use strict';

const settings = [
    {key: "navigation.dashboard.component.default", value: "Home", description: "The default component to display in the dashboard"},
]

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting',
            settings.map(t => {
                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                return t;
            }), {returning: true});

    },

    async down(queryInterface, Sequelize) {
        //delete nav elements first
        await queryInterface.bulkDelete("setting", {
            name: settings.map(t => t.key)
        }, {});
    }
};
