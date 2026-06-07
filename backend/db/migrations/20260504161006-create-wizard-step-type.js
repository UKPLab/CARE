'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        await queryInterface.createTable('wizard_step_type', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            key: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
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

        await queryInterface.bulkInsert('wizard_step_type', [
            { key: 'admin', createdAt: now, updatedAt: now },
            { key: 'general', createdAt: now, updatedAt: now },
            { key: 'mail', createdAt: now, updatedAt: now },
            { key: 'registration', createdAt: now, updatedAt: now },
            { key: 'moodle', createdAt: now, updatedAt: now },
            { key: 'summary', createdAt: now, updatedAt: now },
        ], {});

        await queryInterface.addColumn('wizard_step', 'wizardStepTypeId', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });

        await queryInterface.sequelize.query(`
            UPDATE "wizard_step" AS ws
            SET "wizardStepTypeId" = wst.id
            FROM "wizard_step_type" AS wst
            WHERE ws.type = wst.key
        `);

        await queryInterface.removeColumn('wizard_step', 'type');

        await queryInterface.changeColumn('wizard_step', 'wizardStepTypeId', {
            type: Sequelize.INTEGER,
            allowNull: false,
        });

        await queryInterface.addConstraint('wizard_step', {
            fields: ['wizardStepTypeId'],
            type: 'foreign key',
            name: 'wizard_step_wizardStepTypeId_fkey',
            references: {
                table: 'wizard_step_type',
                field: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeConstraint('wizard_step', 'wizard_step_wizardStepTypeId_fkey');

        await queryInterface.addColumn('wizard_step', 'type', {
            type: Sequelize.STRING,
            allowNull: true,
        });

        await queryInterface.sequelize.query(`
            UPDATE "wizard_step" AS ws
            SET type = wst.key
            FROM "wizard_step_type" AS wst
            WHERE ws."wizardStepTypeId" = wst.id
        `);

        await queryInterface.changeColumn('wizard_step', 'type', {
            type: Sequelize.STRING,
            allowNull: false,
        });

        await queryInterface.removeColumn('wizard_step', 'wizardStepTypeId');

        await queryInterface.dropTable('wizard_step_type');
    },
};
