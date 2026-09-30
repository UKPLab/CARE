'use strict';


module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable('ai_budget', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER,
                },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'user', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                aiModelId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_model', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                aiModelShareId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_model_share', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                aiHookId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_hook', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                aiHookShareId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_hook_share', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                studyId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'study', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                studyStepId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'study_step', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                limitType: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                costLimit: {
                    type: Sequelize.DECIMAL(18, 6),
                    allowNull: false,
                },
                resetAt: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
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
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.fn('NOW'),
                },
                updatedAt: {
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.fn('NOW'),
                },
            }, { transaction });

            // Cap load on each request ORs these entity FKs.
            await queryInterface.addIndex('ai_budget', ['aiModelId'], {
                name: 'ai_budget_aiModelId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['aiModelShareId'], {
                name: 'ai_budget_aiModelShareId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['aiHookId'], {
                name: 'ai_budget_aiHookId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['aiHookShareId'], {
                name: 'ai_budget_aiHookShareId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['studyId'], {
                name: 'ai_budget_studyId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['studyStepId', 'aiHookId'], {
                name: 'ai_budget_studyStepId_aiHookId_index',
                transaction,
            });
            await queryInterface.addIndex('ai_budget', ['userId'], {
                name: 'ai_budget_userId_index',
                transaction,
            });

            // Exactly one valid entity FK pattern must match.
            await queryInterface.sequelize.query(`
                ALTER TABLE "ai_budget" ADD CONSTRAINT "chk_ai_budget_shape" CHECK (
                  ("aiModelId" IS NOT NULL AND "aiModelShareId" IS NULL AND "aiHookId" IS NULL
                   AND "aiHookShareId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("aiModelShareId" IS NOT NULL AND "aiModelId" IS NULL AND "aiHookId" IS NULL
                   AND "aiHookShareId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("aiHookId" IS NOT NULL AND "studyStepId" IS NULL AND "aiModelId" IS NULL
                   AND "aiModelShareId" IS NULL AND "aiHookShareId" IS NULL AND "studyId" IS NULL)
                  OR
                  ("aiHookShareId" IS NOT NULL AND "aiModelId" IS NULL AND "aiModelShareId" IS NULL
                   AND "aiHookId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("studyId" IS NOT NULL AND "aiModelId" IS NULL AND "aiModelShareId" IS NULL
                   AND "aiHookId" IS NULL AND "aiHookShareId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("studyStepId" IS NOT NULL AND "aiHookId" IS NOT NULL AND "aiModelId" IS NULL
                   AND "aiModelShareId" IS NULL AND "aiHookShareId" IS NULL AND "studyId" IS NULL)
                )
            `, { transaction });

            // limitType != TOTAL only makes sense for study or step_hook caps.
            await queryInterface.sequelize.query(`
                ALTER TABLE "ai_budget" ADD CONSTRAINT "chk_ai_budget_limit_type" CHECK (
                "limitType" IN (0, 1, 2) AND
                ("limitType" = 0
                  OR "studyId" IS NOT NULL
                  OR "studyStepId" IS NOT NULL)
                )
            `, { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('ai_budget');
    },
};
