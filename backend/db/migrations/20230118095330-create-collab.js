'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('collab',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                collabHash: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true
                },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: "user", key: "id"
                    }
                },
                documentId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: "document",
                        key: "id"
                    }
                },
                targetType: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                targetId: {
                    type: Sequelize.INTEGER,
                    allowNull: false
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
        await queryInterface.dropTable('collab');
    }
};
