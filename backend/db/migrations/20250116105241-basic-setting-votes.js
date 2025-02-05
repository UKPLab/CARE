'use strict';

const settings = [{
    key: "annotator.comments.votes.enabled",
    value: "true",
    type: "boolean",
    description: "Enable voting on comments"
}, {
    key: "annotator.comments.votes.onlyUpvote",
    value: "false",
    type: "boolean",
    description: "Only allow upvote on comments"
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
