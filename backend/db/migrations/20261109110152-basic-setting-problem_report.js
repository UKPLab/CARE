'use strict';

/**
 * Settings for the topbar problem report popup. Form, attachment, diagnostics and
 * activity settings are readable by every user so the popup can render, sample and
 * pre-validate with the same values the backend enforces (clamped to fixed safety
 * caps). Database health settings are only needed on the server. None hold secrets.
 */

const group = "settings.problemReport.group";

const settings = [
    {
        key: "problemReport.enabled",
        displayName: "settings.problemReport.enabled.displayName",
        description: "settings.problemReport.enabled.description",
        value: "true",
        type: "boolean",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.problemTypes",
        displayName: "settings.problemReport.problemTypes.displayName",
        description: "settings.problemReport.problemTypes.description",
        value: "error,wrongOrMissing,slowOrStuck,otherOrSuggestion",
        type: "string",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.askBlocked",
        displayName: "settings.problemReport.askBlocked.displayName",
        description: "settings.problemReport.askBlocked.description",
        value: "true",
        type: "boolean",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.frequencies",
        displayName: "settings.problemReport.frequencies.displayName",
        description: "settings.problemReport.frequencies.description",
        value: "firstTime,sometimes,everyTime,notSure",
        type: "string",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.description.maxLength",
        displayName: "settings.problemReport.descriptionMaxLength.displayName",
        description: "settings.problemReport.descriptionMaxLength.description",
        value: "5000",
        type: "integer",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.reportsPerHour",
        displayName: "settings.problemReport.reportsPerHour.displayName",
        description: "settings.problemReport.reportsPerHour.description",
        value: "10",
        type: "integer",
        displaySubsection: "settings.problemReport.form",
    },
    {
        key: "problemReport.attachments.allowedTypes",
        displayName: "settings.problemReport.attachmentsAllowedTypes.displayName",
        description: "settings.problemReport.attachmentsAllowedTypes.description",
        value: "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime",
        type: "string",
        displaySubsection: "settings.problemReport.attachments",
    },
    {
        key: "problemReport.attachments.maxCount",
        displayName: "settings.problemReport.attachmentsMaxCount.displayName",
        description: "settings.problemReport.attachmentsMaxCount.description",
        value: "5",
        type: "integer",
        displaySubsection: "settings.problemReport.attachments",
    },
    {
        key: "problemReport.attachments.maxFileSizeMb",
        displayName: "settings.problemReport.attachmentsMaxFileSizeMb.displayName",
        description: "settings.problemReport.attachmentsMaxFileSizeMb.description",
        value: "20",
        type: "number",
        displaySubsection: "settings.problemReport.attachments",
    },
    {
        key: "problemReport.attachments.maxTotalSizeMb",
        displayName: "settings.problemReport.attachmentsMaxTotalSizeMb.displayName",
        description: "settings.problemReport.attachmentsMaxTotalSizeMb.description",
        value: "50",
        type: "number",
        displaySubsection: "settings.problemReport.attachments",
    },
    {
        key: "problemReport.diagnostics.maxEntries",
        displayName: "settings.problemReport.diagnosticsMaxEntries.displayName",
        description: "settings.problemReport.diagnosticsMaxEntries.description",
        value: "50",
        type: "integer",
        displaySubsection: "settings.problemReport.diagnostics",
    },
    {
        key: "problemReport.diagnostics.maxAgeMinutes",
        displayName: "settings.problemReport.diagnosticsMaxAgeMinutes.displayName",
        description: "settings.problemReport.diagnosticsMaxAgeMinutes.description",
        value: "30",
        type: "integer",
        displaySubsection: "settings.problemReport.diagnostics",
    },
    {
        key: "problemReport.diagnostics.maxMessageLength",
        displayName: "settings.problemReport.diagnosticsMaxMessageLength.displayName",
        description: "settings.problemReport.diagnosticsMaxMessageLength.description",
        value: "300",
        type: "integer",
        displaySubsection: "settings.problemReport.diagnostics",
    },
    {
        key: "problemReport.activity.enabled",
        displayName: "settings.problemReport.activityEnabled.displayName",
        description: "settings.problemReport.activityEnabled.description",
        value: "true",
        type: "boolean",
        displaySubsection: "settings.problemReport.activity",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.maxEntries",
        displayName: "settings.problemReport.activityMaxEntries.displayName",
        description: "settings.problemReport.activityMaxEntries.description",
        value: "100",
        type: "integer",
        displaySubsection: "settings.problemReport.activity",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.maxAgeMinutes",
        displayName: "settings.problemReport.activityMaxAgeMinutes.displayName",
        description: "settings.problemReport.activityMaxAgeMinutes.description",
        value: "10",
        type: "integer",
        displaySubsection: "settings.problemReport.activity",
        onlyAdmin: false,
    },
    {
        key: "problemReport.activity.mouseSampleMs",
        displayName: "settings.problemReport.activityMouseSampleMs.displayName",
        description: "settings.problemReport.activityMouseSampleMs.description",
        value: "1000",
        type: "integer",
        displaySubsection: "settings.problemReport.activity",
        onlyAdmin: false,
    },
    {
        key: "problemReport.databaseHealth.enabled",
        displayName: "settings.problemReport.databaseHealthEnabled.displayName",
        description: "settings.problemReport.databaseHealthEnabled.description",
        value: "true",
        type: "boolean",
        displaySubsection: "settings.problemReport.databaseHealth",
        onlyAdmin: true,
    },
    {
        key: "problemReport.databaseHealth.timeoutMs",
        displayName: "settings.problemReport.databaseHealthTimeoutMs.displayName",
        description: "settings.problemReport.databaseHealthTimeoutMs.description",
        value: "2000",
        type: "integer",
        displaySubsection: "settings.problemReport.databaseHealth",
        onlyAdmin: true,
    },
    {
        key: "problemReport.databaseHealth.maxAgeMinutes",
        displayName: "settings.problemReport.databaseHealthMaxAgeMinutes.displayName",
        description: "settings.problemReport.databaseHealthMaxAgeMinutes.description",
        value: "60",
        type: "integer",
        displaySubsection: "settings.problemReport.databaseHealth",
        onlyAdmin: true,
    },
].map((setting) => ({onlyAdmin: false, ...setting, displayGroup: group}));

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
