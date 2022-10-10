'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('nav_group', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                unique: true
            },
            icon: {
                type: Sequelize.STRING,
            },
            description: {
                type: Sequelize.STRING(512)
            },
            admin: {
                type: Sequelize.BOOLEAN,
                default: false,

            },
            order: {
              type: Sequelize.INTEGER,
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
        await queryInterface.dropTable('nav_group');
    }

};
