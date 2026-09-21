"use strict";

const placeholders = [
    {
        placeholderKey: "currentQuestion",
        placeholderLabel: "Current Dialogue question",
        placeholderDescription: "The configured Dialogue question currently being answered.",
        placeholderExample: '{"id":"evidence_1","source":"pr1","answerType":"text"}',
    },
    {
        placeholderKey: "latestAnswer",
        placeholderLabel: "Latest Dialogue answer",
        placeholderDescription: "The student's latest answer and whether it was skipped.",
        placeholderExample: '{"content":"The evidence was unclear.","skipped":false}',
    },
    {
        placeholderKey: "nextQuestion",
        placeholderLabel: "Next Dialogue question",
        placeholderDescription: "The next question selected by CARE, or null when the plan is complete.",
        placeholderExample: '{"id":"justification_1","source":"pr2","answerType":"text"}',
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
