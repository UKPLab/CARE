'use strict';

const settings = [
    {
        key: "annotator.nlp.activated",
        value: true,
        description: "Indicates whether NLP support is activated in the annotation view."
    },
]

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkInsert('setting',
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
