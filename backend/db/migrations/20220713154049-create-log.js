'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('log',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                level: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                message: {
                    type: Sequelize.STRING
                },
                service: {
                    type: Sequelize.STRING
                },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "user", key: "id"
                    }
                },
                timestamp: {
                    type: Sequelize.DATE, allowNull: false
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
        await queryInterface.dropTable('log');
    }
};
