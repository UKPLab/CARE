'use strict';

/**
 * Flag specific models as free (no budget caps applied).
 *
 * Use case: a self-hosted or free model where capping is undesirable. When
 * freeModel is true the budget walker short-circuits after the access
 * check — no cap (model/share/hook/study/step_hook) is evaluated for that
 * model.
 *
 * Default false to preserve existing capping behavior on every existing model.
 */
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
