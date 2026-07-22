'use strict';

// True if any non-deleted user has logged in (matches transform-user-admin guard).
async function hasAnyUserLoggedIn(queryInterface) {
    const rows = await queryInterface.sequelize.query(
        `SELECT 1 AS present FROM "user"
         WHERE "lastLoginAt" IS NOT NULL
           AND "deleted" = false
         LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    return !!(rows && rows.length > 0);
}

/**
 * Seed setup-wizard state settings. Mark wizard complete when the instance
 * already has logged-in users so old installs do not re-enter the wizard.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        const wizardCompleted = (await hasAnyUserLoggedIn(queryInterface)) ? 'true' : 'false';

        await queryInterface.bulkInsert('setting', [
            {
                key: 'app.setup.wizardCompleted',
                value: wizardCompleted,
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
