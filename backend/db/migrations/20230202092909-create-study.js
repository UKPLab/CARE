'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('study',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                userId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "user", key: "id"
                    }
                },
                documentId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "document",
                        key: "id"
                    }
                },
                hash: {
                    type: Sequelize.STRING, allowNull: false, unique: true
                },
                name: {
                    type: Sequelize.STRING,
                },
                collab: {
                    type: Sequelize.BOOLEAN,
                    default: false,
                },
                description: {
                  type: Sequelize.TEXT,
                },
                resumable: {
                    type: Sequelize.BOOLEAN,
                    default: false,
                },
                timeLimit: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                },
                start: {
                    allowNull: true,
                    type: Sequelize.DATE
                },
                end: {
                    allowNull: true,
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
        await queryInterface.dropTable('study');
    }
};
