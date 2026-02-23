'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('app_state', {
            key: {
                allowNull: false,
                type: Sequelize.STRING,
                primaryKey: true,
            },
            value: {
                type: Sequelize.TEXT,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        const now = new Date();
        await queryInterface.bulkInsert('app_state', [
            { key: 'setup.wizardCompleted', value: 'false', createdAt: now, updatedAt: now },
            { key: 'setup.wizardCurrentStep', value: '0', createdAt: now, updatedAt: now },
        ], {});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('app_state');
    },
};
