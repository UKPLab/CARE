'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('project',
            {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER,
                    default: 1
                },
                userId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: "user", key: "id"
                    },
                    allowNull: true,
                    default: null
                },
                name: {
                    type: Sequelize.STRING,
                },
                description: {
                    type: Sequelize.TEXT,
                },
                public: {
                    type: Sequelize.BOOLEAN,
                    default: false,
                },
                closed: {
                    allowNull: true,
                    default: null,
                    type: Sequelize.DATE
                },
                deleted: {
                    type: Sequelize.BOOLEAN,
                    default: false
                },
            });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('project');
    }
};
