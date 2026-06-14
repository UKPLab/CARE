'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('setting', 'showInWizard', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        });
        await queryInterface.addColumn('setting', 'wizardOrder', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });
        await queryInterface.addColumn('setting', 'requiredInWizard', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        });
        await queryInterface.addColumn('setting', 'wizardStepId', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'wizard_step',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });
        await queryInterface.addColumn('setting', 'displayName', {
            type: Sequelize.STRING(256),
            allowNull: true,
        });
        await queryInterface.addColumn('setting', 'displayGroup', {
            type: Sequelize.STRING(128),
            allowNull: true,
        });
        await queryInterface.addColumn('setting', 'displaySubsection', {
            type: Sequelize.STRING(128),
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('setting', 'displaySubsection');
        await queryInterface.removeColumn('setting', 'displayGroup');
        await queryInterface.removeColumn('setting', 'displayName');
        await queryInterface.removeColumn('setting', 'showInWizard');
        await queryInterface.removeColumn('setting', 'wizardOrder');
        await queryInterface.removeColumn('setting', 'requiredInWizard');
        await queryInterface.removeColumn('setting', 'wizardStepId');
    },
};
