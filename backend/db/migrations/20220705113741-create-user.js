'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            sysrole: {
                type: Sequelize.STRING,
                allowNull: false,
                references: {
                    model: "sysrole",
                    key: "name"
                }
            },
            firstName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            lastName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            userName: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            passwordHash: {
                type: Sequelize.STRING,
                allowNull: false
            },
            acceptTerms: {
                    type: Sequelize.BOOLEAN,
                    default: true
                },
            acceptStats: {
                    type: Sequelize.BOOLEAN,
                    default: true
                },
            salt: {
                type: Sequelize.STRING,
                allowNull: false
            },
            lastLoginAt: {
                type: Sequelize.DATE,
                allowNull: true
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
        await queryInterface.dropTable('user');
    }
};