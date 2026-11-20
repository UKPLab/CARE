'use strict';

/**
 * Per-minute request budgets for the REST API, counted per user across their tokens.
 * The general budget covers every request; the heavy one covers uploads, bulk writes, and imports.
 */
const settings = [
    {
        key: 'system.auth.apiTokens.rateLimitPerMinute',
        value: '120',
        type: 'number',
        description: 'Requests per minute one user may send to the REST API, across all their tokens',
        displayName: 'API requests per minute',
    },
    {
        key: 'system.auth.apiTokens.heavyRateLimitPerMinute',
        value: '20',
        type: 'number',
        description: 'Uploads, bulk assignments, bulk study close/open/delete, imports, and session copies per minute one user may send to the REST API',
        displayName: 'API uploads and bulk writes per minute',
    },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('setting', settings.map((setting) => ({
            ...setting,
            displayGroup: 'General',
            displaySubsection: 'API tokens',
            onlyAdmin: true,
            createdAt: now,
            updatedAt: now,
        })));
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', {key: settings.map((setting) => setting.key)});
    },
};
