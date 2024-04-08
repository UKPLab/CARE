'use strict';

const settings = [{
    key: "annotator.sidebar.maxWidth",
    value: 50,
    type: "integer",
    description: "The maximum width of the sidebar (percentage of the screen, in %)"
}, {
    key: "annotator.sidebar.minWidth",
    value: 400,
    type: "integer",
    description: "The minimum width of the sidebar (in px)"
}];

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
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
