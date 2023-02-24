'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('document', {
            id: {
                allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER
            }, name: {
                type: Sequelize.STRING
            }, hash: {
                type: Sequelize.STRING, allowNull: false, unique: true
            }, userId: {
                type: Sequelize.INTEGER, allowNull: false, references: {
                    model: "user", key: "id"
                }
            },
            public: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
    }, async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('document');
    }
};