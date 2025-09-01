"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("document_data", {
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
                primaryKey: true,
                references: {
                    model: "document",
                    key: "id"
                }
            },
            studySessionId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: "study_session",
                    key: "id"
                },
                allowNull: true
            },
            studyStepId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: "study_step",
                    key: "id"
                },
                allowNull: true
            },
            key:{
                type: Sequelize.STRING,
                allowNull: false
            },
            value: {
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
        await queryInterface.dropTable("document_data");
    }
};
