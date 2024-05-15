'use strict';

const settings = [{
    key: "editor.document.showButtonCreate",
    value: "false",
    type: "boolean",
    description: "Show create button in dashboard to create a new html document"
}, {
    key: "editor.document.showButtonDeltaDownload",
    value: "false",
    type: "boolean",
    description: "Show download button for document deltas (edits)"
},
{
    key: "editor.edits.debounceTime",
    value: "150",
    type: "number",
    description: "Delay time in milliseconds before processing edits"
},
{
    key: "editor.toolbar.visibility",
    value: "false", 
    type: "boolean",
    description: "Make toolbar in the editor visible"
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
