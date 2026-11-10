"use strict";

/** Allow assessment and assistant requests together without allowing duplicates.
 * @author Mohammed Rawhani
 */
const INDEX_NAME = "ai_log_one_inflight_per_user_session";

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(`DROP INDEX "${INDEX_NAME}"`, {transaction});
            await queryInterface.sequelize.query(`
                CREATE UNIQUE INDEX "${INDEX_NAME}"
                ON "ai_log" ("userId", COALESCE("studySessionId", 0), ("aiMessageId" IS NOT NULL))
                WHERE status = 'in_progress' AND deleted = false
            `, {transaction});
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(`DROP INDEX "${INDEX_NAME}"`, {transaction});
            await queryInterface.sequelize.query(`
                CREATE UNIQUE INDEX "${INDEX_NAME}"
                ON "ai_log" ("userId", COALESCE("studySessionId", 0))
                WHERE status = 'in_progress' AND deleted = false
            `, {transaction});
        });
    },
};
