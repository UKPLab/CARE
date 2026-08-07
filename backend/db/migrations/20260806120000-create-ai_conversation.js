'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('ai_conversation', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'user', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                studySessionId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'study_session', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                type: {
                    type: Sequelize.INTEGER,
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
            }, { transaction });

            await queryInterface.addConstraint('ai_conversation', {
                fields: ['type'],
                type: 'check',
                where: { type: { [Sequelize.Op.in]: [0, 1] } },
                name: 'chk_ai_conversation_type',
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('ai_conversation');
    },
};
