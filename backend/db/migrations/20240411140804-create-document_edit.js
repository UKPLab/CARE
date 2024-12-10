"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("document_edit", {
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
                }
            },
            documentId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "document",
                    key: "id"
                }
            },
            studySessionId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "study_session",
                    key: "id"
                },
                allowNull: true
            },
            draft: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            offset: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            operationType: {
                type: Sequelize.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change (only retain)
                allowNull: false
            },
            span: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            attributes: {
                type: Sequelize.JSONB,
                allowNull: true,
                defaultValue: null
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
        await queryInterface.dropTable("document_edit");
    }
};
