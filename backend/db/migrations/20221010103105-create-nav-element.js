'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('nav_element', {
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
            default: {
                type: Sequelize.BOOLEAN,
                default: false,
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
            groupId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'nav_group',
                    key: 'id'
                }
            },
            path: {
                type: Sequelize.STRING,
            },
            component: {
                type: Sequelize.STRING,
            },
            alias: {
                type: Sequelize.JSONB
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
        await queryInterface.dropTable('nav_element');
    }
};
