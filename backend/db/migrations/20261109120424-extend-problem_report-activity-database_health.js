'use strict';

/**
 * Add the recent activity trail and the database health snapshot to problem reports.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    /**
     * @param {import('sequelize').QueryInterface} queryInterface
     * @param {import('sequelize')} Sequelize
     */
    async up(queryInterface, Sequelize) {
        // {status: "included"|"noConsent"|"disabled", entries: [...]}; entries only with usage statistics consent
        await queryInterface.addColumn('problem_report', 'activity', {
            type: Sequelize.JSONB,
            allowNull: true,
        });
        // Aggregate counters of the CARE database captured on the server; null when turned off
        await queryInterface.addColumn('problem_report', 'databaseHealth', {
            type: Sequelize.JSONB,
            allowNull: true,
        });
    },

    /**
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async down(queryInterface) {
        await queryInterface.removeColumn('problem_report', 'databaseHealth');
        await queryInterface.removeColumn('problem_report', 'activity');
    },
};
