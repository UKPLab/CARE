'use strict';

module.exports = {
    /**
     * Run the migration - create the "document_metadata" table
     * @param {import('sequelize').QueryInterface} queryInterface
     * @param {import('sequelize')} Sequelize
     */
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('document_metadata', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            documentId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'document',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'user',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            metaKey: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            metaValue: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW'),
            },
        });
    },

    /**
     * Revert the migration - drop the "document_metadata" table
     * @param {import('sequelize').QueryInterface} queryInterface
     * @param {import('sequelize')} Sequelize
     */
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('document_metadata');
    },
};
