'use strict';

/**
 * Stores whether a conversation includes study context.
 * @author Mohammed Rawhani
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('ai_conversation', 'includeContext', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            }, { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn('ai_conversation', 'includeContext', { transaction });
        });
    },
};
