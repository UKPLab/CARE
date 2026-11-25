'use strict';

/**
 * API token settings: the switch that allows personal tokens, the per-minute request budgets for
 * the REST API (counted per user across their tokens; the general budget covers every request, the
 * heavy one uploads, bulk writes, and imports), and the per-IP budget for requests with a bad token.
 */
const settings = [
    {
        key: 'system.auth.apiTokens.enabled',
        value: 'false',
        type: 'boolean',
        description: 'Allow non-guest users to create personal API tokens for the REST API',
        displayName: 'Enable API tokens',
        onlyAdmin: false,
    },
    {
        key: 'system.auth.apiTokens.rateLimitPerMinute',
        value: '120',
        type: 'number',
        description: 'Requests per minute one user may send to the REST API, across all their tokens',
        displayName: 'API requests per minute',
        onlyAdmin: true,
    },
    {
        key: 'system.auth.apiTokens.heavyRateLimitPerMinute',
        value: '20',
        type: 'number',
        description: 'Uploads, bulk assignments, bulk study close/open/delete, imports, and session copies per minute one user may send to the REST API',
        displayName: 'API uploads and bulk writes per minute',
        onlyAdmin: true,
    },
    {
        key: 'system.auth.apiTokens.failedAuthPerMinute',
        value: '60',
        type: 'number',
        description: 'Requests with a missing, wrong, or expired API token one IP address may send per minute before it is blocked for the rest of the minute',
        displayName: 'Failed API token requests per IP per minute',
        onlyAdmin: true,
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
            createdAt: now,
            updatedAt: now,
        })));
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', {key: settings.map((setting) => setting.key)});
    },
};
