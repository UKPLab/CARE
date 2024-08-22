'use strict';

const settings = [{
    key: "editor.document.showButtonCreate",
    value: "true",
    type: "boolean",
    description: "Show create button in dashboard to create a new html document"
},
{
    key: "editor.document.showButtonDeltaDownload",
    value: "false",
    type: "boolean",
    description: "Show download button for document deltas (edits)"
},
{
    key: "editor.document.showButtonHTMLDownload",
    value: "true",
    type: "boolean",
    description: "Show download button for document HTML (edits)"
},

{
    key: "editor.edits.debounceTime",
    value: "150",
    type: "number",
    description: "Delay time in milliseconds before processing edits"
},
{
    key: "editor.toolbar.visibility",
    value: "true", 
    type: "boolean",
    description: "Make toolbar in the editor visible"
},
{
    key: "editor.toolbar.showHTMLDownload",
    value: "true",
    type: "boolean",
    description: "Show download button for the html document"
},
{
    key: "editor.toolbar.tools.font",
    value: "true", 
    type: "boolean",
    description: "Font tool in the toolbar"
},
{
    key: "editor.toolbar.tools.size",
    value: "true", 
    type: "boolean",
    description: "Font size in the toolbar"
},
{
    key: "editor.toolbar.tools.align",
    value: "true",
    type: "boolean",
    description: "Text alignment in the toolbar"
},
{
    key: "editor.toolbar.tools.bold",
    value: "true",
    type: "boolean",
    description: "Bold text in the toolbar"
},
{
    key: "editor.toolbar.tools.italic",
    value: "true",
    type: "boolean",
    description: "Italic text in the toolbar"
},
{
    key: "editor.toolbar.tools.underline",
    value: "true",
    type: "boolean",
    description: "Underline text in the toolbar"
},
{
    key: "editor.toolbar.tools.strike",
    value: "true",
    type: "boolean",
    description: "Strike through text in the toolbar"
},
{
    key: "editor.toolbar.tools.blockquote",
    value: "true",
    type: "boolean",
    description: "Blockquote in the toolbar"
},
{
    key: "editor.toolbar.tools.code-block",
    value: "true",
    type: "boolean",
    description: "Code-block in the toolbar"
},
{
    key: "editor.toolbar.tools.formula",
    value: "false",
    type: "boolean",
    description: "Formula in the toolbar"
},
{
    key: "editor.toolbar.tools.header",
    value: "true",
    type: "boolean",
    description: "Header in the toolbar"
},
{
    key: "editor.toolbar.tools.subscript",
    value: "true",
    type: "boolean",
    description: " Subscript in the toolbar"
},
{
    key: "editor.toolbar.tools.superscript",
    value: "true",
    type: "boolean",
    description: "Superscript in the toolbar"
},
{
    key: "editor.toolbar.tools.indent",
    value: "true",
    type: "boolean",
    description: "Indent in the toolbar"
},
{
    key: "editor.toolbar.tools.direction",
    value: "true",
    type: "boolean",
    description: "Text direction in the toolbar"
},
{
    key: "editor.toolbar.tools.color",
    value: "true",
    type: "boolean",
    description: "Text color in the toolbar"
},
{
    key: "editor.toolbar.tools.background",
    value: "true",
    type: "boolean",
    description: "Text background color in the toolbar"
},
{
    key: "editor.toolbar.tools.orderedList",
    value: "true",
    type: "boolean",
    description: "Ordered list in the toolbar"
},
{
    key: "editor.toolbar.tools.unorderedList",
    value: "true",
    type: "boolean",
    description: "Bullet list in the toolbar"
},
{
    key: "editor.toolbar.tools.checkList",
    value: "true",
    type: "boolean",
    description: "Check list in the toolbar"
},
{
    key: "editor.toolbar.tools.link",
    value: "false",
    type: "boolean",
    description: "Link tool in the toolbar"
},
{
    key: "editor.toolbar.tools.image",
    value: "false",
    type: "boolean",
    description: "Image tool in the toolbar"
},
{
    key: "editor.toolbar.tools.video",
    value: "false",
    type: "boolean",
    description: "Video tool in the toolbar"
},
{
    key: "editor.toolbar.tools.clean",
    value: "true",
    type: "boolean",
    description: "Clean tool in the toolbar"
},

];

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
