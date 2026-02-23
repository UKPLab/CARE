'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        await queryInterface.bulkInsert('setting', [
            {
                key: 'app.setup.wizardCompleted',
                value: 'false',
                type: 'boolean',
                description: 'Whether the setup wizard has been completed',
                createdAt: now,
                updatedAt: now,
            },
            {
                key: 'app.setup.wizardCurrentStep',
                value: '0',
                type: 'string',
                description: 'Current step index in the setup wizard',
                createdAt: now,
                updatedAt: now,
            },
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('setting', {
            key: ['app.setup.wizardCompleted', 'app.setup.wizardCurrentStep'],
        }, {});
    },
};
