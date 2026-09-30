"use strict";

const fs = require("fs");
const path = require("path");

const PLAN_JSON_PATHS = [
    "20260824121000-basic-configuration-dialogue_plan_adaptive.json",
];

function readJsonFromDisk(filename) {
    const absolutePath = path.resolve(__dirname, filename);
    const content = fs.readFileSync(absolutePath, "utf8");
    return JSON.parse(content);
}

const plans = PLAN_JSON_PATHS.map(readJsonFromDisk);
const BOT_USER_ID = 2;

module.exports = {
    async up(queryInterface, Sequelize) {
        const adminId = await queryInterface.rawSelect("user", {where: {userName: "admin"}}, ["id"]);
        const userId = adminId || BOT_USER_ID;
        const now = new Date();
        const toJsonb = (obj) => Sequelize.literal(`'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`);

        await queryInterface.bulkInsert(
            "configuration",
            plans.map((plan) => ({
                name: plan.name,
                description: plan.description,
                userId,
                hideInFrontend: false,
                type: 2,
                content: toJsonb(plan),
                deleted: false,
                createdAt: now,
                updatedAt: now,
            })),
            {}
        );
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("configuration", {
            name: {[Sequelize.Op.in]: plans.map((plan) => plan.name)},
        }, {});
    },
};
