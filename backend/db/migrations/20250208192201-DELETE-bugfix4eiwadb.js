// extend project db with missing columns
// and set default project public to true (has id = 1 / update the default project)

'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('UPDATE project SET "public" = true WHERE id = 1', {
            type: queryInterface.sequelize.QueryTypes.UPDATE,
        });
        await queryInterface.addColumn("project", "createdAt", {
            allowNull: true,
            type: Sequelize.DATE,
        });
        await queryInterface.addColumn("project", "updatedAt", {
            allowNull: true,
            type: Sequelize.DATE,
        });
        await queryInterface.addColumn("project", "deletedAt", {
            allowNull: true,
            defaultValue: null,
            type: Sequelize.DATE
        });


    }
};