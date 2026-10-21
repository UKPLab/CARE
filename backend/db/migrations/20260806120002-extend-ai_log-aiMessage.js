'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('ai_log', 'aiMessageId', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'ai_message', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            }, { transaction });
            await queryInterface.addColumn('ai_log', 'totalLatencyMs', {
                type: Sequelize.INTEGER,
                allowNull: true,
            }, { transaction });
            await queryInterface.addColumn('ai_log', 'ttftMs', {
                type: Sequelize.INTEGER,
                allowNull: true,
            }, { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn('ai_log', 'ttftMs', { transaction });
            await queryInterface.removeColumn('ai_log', 'totalLatencyMs', { transaction });
            await queryInterface.removeColumn('ai_log', 'aiMessageId', { transaction });
        });
    },
};
