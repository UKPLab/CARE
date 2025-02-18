'use strict';

const settings = [{
    key: "editor.edits.showHistoryForUser",
    value: "false",
    type: "boolean",
    description: "Show the history of edits for all users (default only admins)"
},{
    key: "editor.edits.historyGroupTime",
    value: 60 * 1000,
    type: "integer",
    description: "The edits will be merged into groups when there is less than this time between them"
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
