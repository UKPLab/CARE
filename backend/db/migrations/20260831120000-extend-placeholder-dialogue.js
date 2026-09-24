"use strict";

const placeholders = [
    {
        placeholderKey: "dialogueDecision",
        placeholderLabel: "Dialogue decision input",
        placeholderDescription: "The current Dialogue question and the latest answer, filled by CARE.",
        placeholderExample: '{"currentQuestion":{"text":"What led you to this comment?","help":"","evidenceGoal":"","completeWhen":"","followUpDirection":""},"latestAnswer":{"content":"The method was unclear."}}',
    },
    {
        placeholderKey: "dialogueAnchors",
        placeholderLabel: "Dialogue anchor candidates",
        placeholderDescription: "The anchored Dialogue questions with review excerpts from their source, filled by CARE.",
        placeholderExample: '[{"id":"evidence_1","source":"pr1","questionText":"What led you to this comment?","evidenceGoal":"","candidates":[{"index":0,"text":"The method needs more detail."}]}]',
    },
];

module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert("placeholder", placeholders.map((placeholder) => ({
            ...placeholder,
            type: 8,
            placeholderType: "text",
            required: false,
            deleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
        })), {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("placeholder", {
            type: 8,
            placeholderKey: {[Sequelize.Op.in]: placeholders.map(({placeholderKey}) => placeholderKey)},
        }, {});
    },
};
