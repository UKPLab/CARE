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
            hash: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            creator: {
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
            tags: {
                type: Sequelize.STRING
            },
            document: {
                type: Sequelize.STRING,
                references: {
                    model: "document",
                    key: "hash"
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