"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("user", "extId", {
            allowNull: true,
            type: Sequelize.INTEGER,
            unique: true
        });
        await queryInterface.changeColumn("user", "acceptStats", {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        });
        await queryInterface.changeColumn("user", "acceptTerms", {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        });
        await queryInterface.addColumn(
            'user',
            'initialPassword',
            {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: null
            }
        )
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("user", "extId");
        await queryInterface.changeColumn("user", "acceptStats", {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        });
        await queryInterface.changeColumn("user", "acceptTerms", {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        });
        await queryInterface.removeColumn('user', 'initialPassword');
    },
};
