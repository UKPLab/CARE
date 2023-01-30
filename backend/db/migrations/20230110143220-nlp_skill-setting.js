'use strict';

const settings = [
    {
        key: "annotator.nlp.activated",
        value: true,
        description: "Indicates whether NLP support is activated in the annotation view."
    },
    {
        key: "annotator.nlp.summarization.skillName",
        value: "summarization",
        description: "The skill name to use for summarization."
    },
    {
        key: "annotator.nlp.summarization.activated",
        value: true,
        type: "boolean",
        description: "Indicates whether summarization is activated."
    },
    {
        key: "annotator.nlp.summarization.annoLength",
        value: 10,
        type: "integer",
        description: "The minimum length of the annotation to generate a summary."
    },
    {
        key: "annotator.nlp.summarization.minLength",
        value: 10,
        type: "integer",
        description: "The minimum length of the summary (in tokens of the model)."
    },
    {
        key: "annotator.nlp.summarization.maxLength",
        value: 30,
        type: "integer",
        description: "The maximum length of the summary (in tokens of the model)."
    },
    {
        key: "annotator.nlp.summarization.timeout",
        value: 10000,
        type: "integer",
        description: "The timeout for the summarization request."
    }
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
