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
                description: 'Internal setup wizard completion state.',
                onlyAdmin: true,
                showInWizard: false,
                requiredInWizard: false,
                deleted: false,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            },
            {
                key: 'app.setup.wizardCurrentStep',
                value: '0',
                type: 'integer',
                description: 'Internal setup wizard current step.',
                onlyAdmin: true,
                showInWizard: false,
                requiredInWizard: false,
                deleted: false,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            },
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('setting', {
            key: ['app.setup.wizardCompleted', 'app.setup.wizardCurrentStep'],
        }, {});
    },
};
