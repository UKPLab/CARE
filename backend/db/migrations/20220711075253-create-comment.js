'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('comment', {
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
                type: Sequelize.STRING(4096)
            },
            draft: {
                type: Sequelize.BOOLEAN,
                defaultVale: true
            },
            document: {
                type: Sequelize.STRING,
                references: {
                    model: "document",
                    key: "hash"
                }
            },
            referenceAnnotation: {
                type: Sequelize.INTEGER,
                references: {
                    model: "annotation",
                    key: "id"
                },
                allowNull: true,
                defaultValue: null
            },
            referenceComment: {
                type: Sequelize.INTEGER,
                references: {
                    model: "comment",
                    key: "id"
                },
                allowNull: true,
                defaultValue: null
            },
            tags: {
                type: Sequelize.STRING
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
        await queryInterface.dropTable('comment');
    }
};