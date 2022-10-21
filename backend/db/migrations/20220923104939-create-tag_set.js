'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('tag_set', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: true, // if null, then it's a global tag (system-wide)
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
            name: {
                type: Sequelize.STRING,
            },
            description: {
                type: Sequelize.STRING(512)
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
        await queryInterface.dropTable('tag_set');
    }
};
