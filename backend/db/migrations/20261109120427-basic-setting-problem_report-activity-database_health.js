'use strict';

/**
 * Settings for the activity trail and the database health snapshot of problem reports.
 *
 * Activity settings are readable by every user because the browser samples the
 * trail with them; the backend applies the same values again (clamped to fixed
 * safety caps). Activity is only collected from users who agreed to usage
 * statistics. Database health settings are only needed on the server.
 */

const group = "settings.problemReport.group";

const settings = [
    {
        key: "problemReport.activity.enabled",
        displayName: "settings.problemReport.activityEnabled.displayName",
        description: "settings.problemReport.activityEnabled.description",
        value: "true",
        type: "boolean",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.maxEntries",
        displayName: "settings.problemReport.activityMaxEntries.displayName",
        description: "settings.problemReport.activityMaxEntries.description",
        value: "100",
        type: "integer",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.maxAgeMinutes",
        displayName: "settings.problemReport.activityMaxAgeMinutes.displayName",
        description: "settings.problemReport.activityMaxAgeMinutes.description",
        value: "10",
        type: "integer",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.mouseSampleMs",
        displayName: "settings.problemReport.activityMouseSampleMs.displayName",
        description: "settings.problemReport.activityMouseSampleMs.description",
        value: "1000",
        type: "integer",
        onlyAdmin: false,
    },
    {
        key: "problemReport.databaseHealth.enabled",
        displayName: "settings.problemReport.databaseHealthEnabled.displayName",
        description: "settings.problemReport.databaseHealthEnabled.description",
        value: "true",
        type: "boolean",
        onlyAdmin: true,
    },
    {
        key: "problemReport.databaseHealth.timeoutMs",
        displayName: "settings.problemReport.databaseHealthTimeoutMs.displayName",
        description: "settings.problemReport.databaseHealthTimeoutMs.description",
        value: "2000",
        type: "integer",
        onlyAdmin: true,
    },
    {
        key: "problemReport.databaseHealth.maxAgeMinutes",
        displayName: "settings.problemReport.databaseHealthMaxAgeMinutes.displayName",
        description: "settings.problemReport.databaseHealthMaxAgeMinutes.description",
        value: "60",
        type: "integer",
        onlyAdmin: true,
    },
].map((setting) => ({
    ...setting,
    displayGroup: group,
    displaySubsection: setting.key.startsWith("problemReport.activity.")
        ? "settings.problemReport.activity"
        : "settings.problemReport.databaseHealth",
}));

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert("setting", settings.map((setting) => ({
            ...setting,
            createdAt: now,
            updatedAt: now,
        })));
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map((setting) => setting.key),
        });
    },
};
