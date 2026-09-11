'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('setting', [{
            key: 'system.auth.apiTokens.enabled',
            value: 'false',
            type: 'boolean',
            description: 'Allow non-guest users to create personal API tokens for the REST API',
            displayName: 'Enable API tokens',
            displayGroup: 'General',
            displaySubsection: 'API tokens',
            onlyAdmin: false,
            createdAt: now,
            updatedAt: now,
        }]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', {key: 'system.auth.apiTokens.enabled'});
    },
};
