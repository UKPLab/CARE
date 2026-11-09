'use strict';

/**
 * Create the "problem_report" table for reports submitted from the topbar Report button.
 * Reports are private: only the reporter and administrators can read them.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    /**
     * Run the migration - create the "problem_report" table
     * @param {import('sequelize').QueryInterface} queryInterface
     * @param {import('sequelize')} Sequelize
     */
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('problem_report', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'user',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            // Client-generated id per opened form; repeated submits with the same id return the first report
            clientRequestId: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            problemTypes: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            blocked: {
                type: Sequelize.BOOLEAN,
                allowNull: true,
            },
            frequency: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            // Automatic context: page, report time, CARE version/build, browser, operating system
            context: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            // Sanitized recent diagnostic events (bounded on the server)
            diagnostics: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            // Attachment metadata; file contents live under files/problem_reports
            attachments: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
        });

        await queryInterface.addIndex('problem_report', ['userId', 'clientRequestId'], {
            unique: true,
            name: 'problem_report_user_client_request_unique',
        });
        await queryInterface.addIndex('problem_report', ['createdAt'], {
            name: 'problem_report_created_at',
        });
    },

    /**
     * Revert the migration - drop the "problem_report" table
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async down(queryInterface) {
        await queryInterface.dropTable('problem_report');
    },
};
