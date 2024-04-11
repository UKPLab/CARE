'use strict';

const settings = [{
    key: "editor.document.showButtonAdd",
    value: "false",
    type: "boolean",
    description: "Show add button in dashboard to create a new html document"
}, {
    key: "editor.document.showButtonDeltaDownload",
    value: "false",
    type: "boolean",
    description: "Show download button for document deltas (edits)"
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
