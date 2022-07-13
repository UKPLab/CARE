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
                timestamp: {
                    type: Sequelize.DATE, allowNull: false
                },
                createdAt: {
                    allowNull: false, type: Sequelize.DATE
                }, updatedAt: {
                    allowNull: false, type: Sequelize.DATE
                }
            });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('log');
    }
};
