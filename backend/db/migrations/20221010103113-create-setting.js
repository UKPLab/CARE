'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('setting', {
            key: {
                allowNull: false,
                type: Sequelize.STRING,
                primaryKey: true,
            },
            value: {
                type: Sequelize.STRING,
            },
            type: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            description: {
                type: Sequelize.STRING(512)
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
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('setting');
    }
};
