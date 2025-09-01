'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_environment', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'user',
                    key: 'id'
                }
            },
            documentId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'document',
                    key: 'id'
                }
            },
            studySessionId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'study_session',
                    key: 'id'
                }
            },
            studyStepId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'study_step',
                    key: 'id'
                }
            },
            key: {
                type: Sequelize.STRING,
                allowNull: false
            },
            value: {
                type: Sequelize.STRING,
                allowNull: false
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
        await queryInterface.dropTable('user_environment');
    }
};