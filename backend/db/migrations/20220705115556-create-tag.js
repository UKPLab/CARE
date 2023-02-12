'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('tag', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: true, // if null, then it's a global tag
                references: {
                    model: 'user',
                    key: 'id'
                }
            },
            public: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            tagSetId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "tag_set",
                    key: "id"
                },
                allowNull: false
            },
            description: {
                type: Sequelize.STRING
            },
            colorCode: {
                type: Sequelize.STRING,
                allowNull: true
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
        await queryInterface.dropTable('tag');
    }
};