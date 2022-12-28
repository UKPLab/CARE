'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('sysrole', {
            name: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
                primaryKey: true
            },
            description: {
                type: Sequelize.STRING
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            deletedAt: {
                allowNull: true,
                defaultValue: null,
                type: Sequelize.DATE
            }
        });
    }, async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('sysrole');
    }
};