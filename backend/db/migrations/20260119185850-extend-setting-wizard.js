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
        await queryInterface.addColumn('setting', 'wizardStep', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('setting', 'showInWizard');
        await queryInterface.removeColumn('setting', 'wizardOrder');
        await queryInterface.removeColumn('setting', 'requiredInWizard');
        await queryInterface.removeColumn('setting', 'wizardStep');
    },
};
