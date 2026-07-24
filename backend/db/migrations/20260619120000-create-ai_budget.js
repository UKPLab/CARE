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
                modelId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_model', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                shareId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_model_share', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                hookId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: { model: 'ai_hook', key: 'id' },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                hookShareId: {
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

            // Exactly one valid entity FK pattern must match. Mirrors
            // chk_assignment_share_exclusive in 20260418000000-create-assignment_share.js.
            await queryInterface.sequelize.query(`
                ALTER TABLE "ai_budget" ADD CONSTRAINT "chk_ai_budget_shape" CHECK (
                  ("modelId" IS NOT NULL AND "shareId" IS NULL AND "hookId" IS NULL
                   AND "hookShareId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("shareId" IS NOT NULL AND "modelId" IS NULL AND "hookId" IS NULL
                   AND "hookShareId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("hookId" IS NOT NULL AND "studyStepId" IS NULL AND "modelId" IS NULL
                   AND "shareId" IS NULL AND "hookShareId" IS NULL AND "studyId" IS NULL)
                  OR
                  ("hookShareId" IS NOT NULL AND "modelId" IS NULL AND "shareId" IS NULL
                   AND "hookId" IS NULL AND "studyId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("studyId" IS NOT NULL AND "modelId" IS NULL AND "shareId" IS NULL
                   AND "hookId" IS NULL AND "hookShareId" IS NULL AND "studyStepId" IS NULL)
                  OR
                  ("studyStepId" IS NOT NULL AND "hookId" IS NOT NULL AND "modelId" IS NULL
                   AND "shareId" IS NULL AND "hookShareId" IS NULL AND "studyId" IS NULL)
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
