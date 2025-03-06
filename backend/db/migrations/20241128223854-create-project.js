'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('project',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER,
                },
                userId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "user", key: "id"
                    },
                    allowNull: true,
                    default: null
                },
                name: {
                    type: Sequelize.STRING,
                },
                description: {
                    type: Sequelize.TEXT,
                },
                public: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false,
                },
                closed: {
                    allowNull: true,
                    defaultValue: null,
                    type: Sequelize.DATE
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
        await queryInterface.dropTable('project');
    }
};
