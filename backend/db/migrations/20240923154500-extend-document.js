'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('document', 'parentDocumentId', {
            type: Sequelize.INTEGER,
            references: {
                model: 'document',
                key: 'id'
            },
            allowNull: true,
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn("document", "uploadedByUserId", {
            type: Sequelize.INTEGER,
            references: {
                model: 'user',
                key: 'id'
            },
            allowNull: true,
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('document', 'hideInFrontend', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('document', 'parentDocumentId');
        await queryInterface.removeColumn('document', 'hideInFrontend');
        await queryInterface.removeColumn("document", "uploadedByUserId");
    }
};
