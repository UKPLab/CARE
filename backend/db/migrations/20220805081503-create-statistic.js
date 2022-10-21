'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('statistic',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                action: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                data: {
                    type: Sequelize.STRING
                },
                user: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "user", key: "id"
                    }
                },
                timestamp: {
                    type: Sequelize.DATE, allowNull: false
                },
                createdAt: {
                    allowNull: false, type: Sequelize.DATE
                },
                updatedAt: {
                    allowNull: false, type: Sequelize.DATE
                }
            });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('statistic');
    }
};
