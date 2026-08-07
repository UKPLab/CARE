'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('ai_message', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                conversationId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'ai_conversation', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                studyStepId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'study_step', key: 'id' },
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                },
                documentId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'document', key: 'id' },
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                },
                aiModelId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'ai_model', key: 'id' },
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                },
                role: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                },
                content: {
                    type: Sequelize.TEXT,
                    allowNull: false,
                },
                status: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                },
                metadata: {
                    type: Sequelize.JSONB,
                    allowNull: true,
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

            await queryInterface.addConstraint('ai_message', {
                fields: ['role'],
                type: 'check',
                where: { role: { [Sequelize.Op.in]: [0, 1, 2] } },
                name: 'chk_ai_message_role',
                transaction,
            });
            await queryInterface.addConstraint('ai_message', {
                fields: ['status'],
                type: 'check',
                where: { status: { [Sequelize.Op.in]: [0, 1, 2, 3] } },
                name: 'chk_ai_message_status',
                transaction,
            });
            await queryInterface.addIndex('ai_message', ['conversationId', 'id'], {
                name: 'ai_message_conversationId_id_index',
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('ai_message');
    },
};
