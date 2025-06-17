'use strict';

const settings = [{
    key: "modal.nlp.request.timeout",
    value: 15000, // default value in ms
    type: "integer",
    description: "The timeout for the NLP Service request in modal (frontend, ms)"
}];

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkInsert('setting', settings.map(t => {
            t['createdAt'] = new Date();
            t['updatedAt'] = new Date();
            return t;
        }), {returning: true});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});
    }
};