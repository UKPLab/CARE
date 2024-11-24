'use strict';

const settings = [{
    key: "rpc.moodleAPI.courseID",
    value: 1,
    type: "integer",
    description: "The ID of the course in Moodle from which to fetch the data"
}, {
    key: "rpc.moodleAPI.showInput.courseID",
    value: "true",
    type: "boolean",
    description: "Show the input field to allow changing the course ID"
},{
    key: "rpc.moodleAPI.apiKey",
    value: "",
    type: "string",
    description: "The Moodle API key for the connection"
}, {
    key: "rpc.moodleAPI.showInput.apiKey",
    value: "true",
    type: "boolean",
    description: "Show the input field to allow changing the API key"
},{
    key: "rpc.moodleAPI.apiUrl",
    value: "",
    type: "string",
    description: "The URL of the Moodle API"
}, {
    key: "rpc.moodleAPI.showInput.apiUrl",
    value: "true",
    type: "boolean",
    description: "Show the input field to allow changing the API URL"
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
