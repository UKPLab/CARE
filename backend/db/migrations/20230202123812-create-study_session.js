'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('study_session',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                studyId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "study", key: "id"
                    }
                },
                userId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "user", key: "id"
                    }
                },
                hash: {
                    type: Sequelize.STRING, allowNull: false, unique: true
                },
                public: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                studySessionId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "study_session", key: "id"
                    },
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
                evaluation: {
                    type: Sequelize.INTEGER,
                    allowNull: true
                },
                reviewComment: {
                    allowNull: true,
                    type: Sequelize.TEXT
                },
                reviewUserId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "user", key: "id"
                    }
                },
                comment: {
                    allowNull: true,
                    type: Sequelize.TEXT
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
        await queryInterface.dropTable('study_session');
    }
};
