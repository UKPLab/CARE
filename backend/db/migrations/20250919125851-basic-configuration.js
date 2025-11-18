"use strict";

const fs = require("fs");
const path = require("path");

function readJsonFromDisk(filename) {
    const absolutePath = path.resolve(__dirname, filename);
    const content = fs.readFileSync(absolutePath, "utf8");
    return JSON.parse(content);
}

const ASSESSMENT_JSON_PATH = "20250919125851-basic-configuration-expose_assessment.json";
const VALIDATION_JSON_PATH = "20250919125851-basic-configuration-expose_validation.json";
const FEEDBACK_JSON_PATH = "20250919125851-basic-configuration-expose_feedback.json";
const ASSESSMENT_JSON_PATH_GERMAN = "20250919125851-basic-configuration-expose_assessment_german.json";
const FEEDBACK_JSON_PATH_GERMAN = "20250919125851-basic-configuration-expose_feedback_german.json";

const assessmentContent = readJsonFromDisk(ASSESSMENT_JSON_PATH);
const feedbackContent = readJsonFromDisk(FEEDBACK_JSON_PATH);
const validationContent = readJsonFromDisk(VALIDATION_JSON_PATH);
const assessmentContentGerman = readJsonFromDisk(ASSESSMENT_JSON_PATH_GERMAN);
const feedbackContentGerman = readJsonFromDisk(FEEDBACK_JSON_PATH_GERMAN);

module.exports = {
    /**
     * Run the migration – create basic entries in the configuration table by loading json files in the migration.
     * @param {import('sequelize').QueryInterface} queryInterface
     * @param {import('sequelize')} Sequelize
     */
    async up(queryInterface, Sequelize) {
        const adminId = await queryInterface.rawSelect("user", {where: {userName: "admin"}}, ["id"]);
        const userId = adminId || 1;

        const now = new Date();
        const toJsonb = (obj) => Sequelize.literal(`'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`);

        await queryInterface.bulkInsert(
            "configuration",
            [
                {
                    name: assessmentContent.name,
                    description: assessmentContent.description,
                    userId: userId,
                    hideInFrontend: false,
                    type: 0, // The type of configuration (0='assessment', 1='validation')
                    content: toJsonb(assessmentContent),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    name: feedbackContent.name,
                    description: feedbackContent.description,
                    userId: userId,
                    hideInFrontend: false,
                    type: 0,
                    content: toJsonb(feedbackContent),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    name: validationContent.name,
                    description: validationContent.description,
                    userId: userId,
                    hideInFrontend: false,
                    type: 1,
                    content: toJsonb(validationContent),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    name: assessmentContentGerman.name,
                    description: assessmentContentGerman.description,
                    userId: userId,
                    hideInFrontend: false,
                    type: 0,
                    content: toJsonb(assessmentContentGerman),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    name: feedbackContentGerman.name,
                    description: feedbackContentGerman.description,
                    userId: userId,
                    hideInFrontend: false,
                    type: 0,
                    content: toJsonb(feedbackContentGerman),
                    deleted: false,
                    createdAt: now,
                    updatedAt: now,
                },
            ],
            {}
        );
    },

    async down(queryInterface, Sequelize) {
        const namesToDelete = [
            assessmentContent && assessmentContent.name,
            feedbackContent && feedbackContent.name,
            validationContent && validationContent.name,
            assessmentContentGerman && assessmentContentGerman.name,
            feedbackContentGerman && feedbackContentGerman.name,
        ].filter(Boolean);

        await queryInterface.bulkDelete("configuration", {name: {[Sequelize.Op.in]: namesToDelete}}, {});
    },
};
