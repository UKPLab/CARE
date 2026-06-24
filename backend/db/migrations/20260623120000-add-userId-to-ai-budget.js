'use strict';

/**
 * Add userId to ai_budget so ownership lookups are O(1) instead of walking
 * FK chains at read time. Backfill walks the chains once for existing rows.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('ai_budget', 'userId', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: null,
                references: { model: 'user', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            }, { transaction });

            // Backfill: for each of the 6 FK patterns, resolve the owning user
            // by walking up to the entity that carries userId directly.
            await queryInterface.sequelize.query(`
                UPDATE ai_budget ab
                SET "userId" = CASE
                    WHEN ab."modelId" IS NOT NULL THEN
                        (SELECT m."userId" FROM ai_model m WHERE m.id = ab."modelId")
                    WHEN ab."shareId" IS NOT NULL THEN
                        (SELECT m."userId" FROM ai_model_share s
                            JOIN ai_model m ON m.id = s."aiModelId"
                            WHERE s.id = ab."shareId")
                    WHEN ab."hookShareId" IS NOT NULL THEN
                        (SELECT h."userId" FROM ai_hook_share hs
                            JOIN ai_hook h ON h.id = hs."aiHookId"
                            WHERE hs.id = ab."hookShareId")
                    WHEN ab."studyStepId" IS NOT NULL THEN
                        (SELECT s."userId" FROM study_step ss
                            JOIN study s ON s.id = ss."studyId"
                            WHERE ss.id = ab."studyStepId")
                    WHEN ab."studyId" IS NOT NULL THEN
                        (SELECT s."userId" FROM study s WHERE s.id = ab."studyId")
                    WHEN ab."hookId" IS NOT NULL THEN
                        (SELECT h."userId" FROM ai_hook h WHERE h.id = ab."hookId")
                END
            `, { transaction });

            await queryInterface.changeColumn('ai_budget', 'userId', {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'user', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            }, { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('ai_budget', 'userId');
    },
};
