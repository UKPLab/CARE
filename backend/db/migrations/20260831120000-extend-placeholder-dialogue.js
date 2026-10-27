"use strict";

const placeholders = [
    {
        placeholderKey: "dialogueDecision",
        placeholderLabel: "templates.placeholders.labels.prompt.dialogueDecision",
        placeholderDescription: "templates.placeholders.descriptions.prompt.dialogueDecision",
        placeholderExample: '{"currentQuestion":{"text":"What led you to this comment?","help":"","evidenceGoal":"","completeWhen":"","followUpDirection":""},"latestAnswer":{"content":"The method was unclear."}}',
    },
    {
        placeholderKey: "dialogueAnchors",
        placeholderLabel: "templates.placeholders.labels.prompt.dialogueAnchors",
        placeholderDescription: "templates.placeholders.descriptions.prompt.dialogueAnchors",
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
