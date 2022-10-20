'use strict';

const settings = [
    {key: "navigation.dashboard.component.default", value: "Home", description: "The default component to display in the dashboard"},
    {key: "tags.tagSet.default", value: "1", description: "The default tagset to use for new tags"},
    {key: "tagsSet.default", value: "1", description: "The default tagset loaded in the annotator, if none has been set by the user"},
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
            key: settings.map(t => t.key)
        }, {});
    }
};
