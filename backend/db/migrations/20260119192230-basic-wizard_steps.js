'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        await queryInterface.bulkInsert('wizard_step', [
            { key: 'admin', order: 1, title: 'Admin Account', description: 'Create the administrator account', type: 'admin', deleted: false, createdAt: now, updatedAt: now, deletedAt: null },
            { key: 'general', order: 2, title: 'General Settings', description: 'Copyright, consent, guest login, external links', type: 'general', deleted: false, createdAt: now, updatedAt: now, deletedAt: null },
            { key: 'mail', order: 3, title: 'Mail Configuration', description: 'Enable email service and configure SMTP/sendmail', type: 'mail', deleted: false, createdAt: now, updatedAt: now, deletedAt: null },
            { key: 'registration', order: 4, title: 'User Registration', description: 'What is required at signup', type: 'registration', deleted: false, createdAt: now, updatedAt: now, deletedAt: null },
            { key: 'summary', order: 6, title: 'Summary', description: 'Review your choices before finishing', type: 'summary', deleted: false, createdAt: now, updatedAt: now, deletedAt: null },
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('wizard_step', {
            key: ['admin', 'general', 'mail', 'registration', 'moodle', 'summary'],
        }, {});
    },
};
