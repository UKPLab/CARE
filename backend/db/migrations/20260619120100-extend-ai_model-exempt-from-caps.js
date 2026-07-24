'use strict';


module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            "ai_model",
            "freeModel",
            {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn("ai_model", "freeModel");
    },
};
