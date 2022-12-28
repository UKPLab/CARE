'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('annotation', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            userId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "user",
                    key: "id"
                },
                allowNull: false
            },
            text: {
                type: Sequelize.STRING(1024)
            },
            tag: {
                type: Sequelize.INTEGER,
                references: {
                    model: "tag",
                    key: "id"
                },
                allowNull: false
            },
            documentId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "document",
                    key: "id"
                }
            },
            selectors: {
                type: Sequelize.JSONB,
                allowNull: false,
            },
            draft: {
                type: Sequelize.BOOLEAN,
                defaultVale: true
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
        await queryInterface.dropTable('annotation');
    }
};