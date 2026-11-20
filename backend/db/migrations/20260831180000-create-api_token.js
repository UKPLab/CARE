'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('api_token', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            userId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'user',
                    key: 'id',
                },
            },
            name: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            keyHash: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            prefix: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            lastUsedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            },
        });
        await queryInterface.addIndex('api_token', ['keyHash'], {unique: true});
        await queryInterface.addIndex('api_token', ['userId']);

        await queryInterface.createTable('api_token_right', {
            apiTokenId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: 'api_token',
                    key: 'id',
                },
            },
            userRightName: {
                allowNull: false,
                type: Sequelize.STRING,
                primaryKey: true,
                references: {
                    model: 'user_right',
                    key: 'name',
                },
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('api_token_right');
        await queryInterface.dropTable('api_token');
    },
};
