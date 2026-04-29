'use strict';

// FK constraints to convert to ON DELETE CASCADE.
// Deleting a study_session row will automatically cascade through the full
// annotation → comment → comment_vote chain, eliminating the need for
// manual ordering in application code.
const CASCADE_FKS = [
    { table: 'annotation',    column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'comment',       column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'comment',       column: 'annotationId',   refTable: 'annotation',    refColumn: 'id' },
    { table: 'comment_vote',  column: 'commentId',      refTable: 'comment',       refColumn: 'id' },
    { table: 'document_edit', column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'document_data', column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'collab',        column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'comment_state',    column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
    { table: 'user_environment', column: 'studySessionId', refTable: 'study_session', refColumn: 'id' },
];

module.exports = {
    async up(queryInterface) {
        for (const { table, column, refTable, refColumn } of CASCADE_FKS) {
            const name = `${table}_${column}_fkey`;
            await queryInterface.sequelize.query(
                `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`
            );
            await queryInterface.sequelize.query(
                `ALTER TABLE "${table}" ADD CONSTRAINT "${name}"
                 FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE CASCADE`
            );
        }
    },

    async down(queryInterface) {
        for (const { table, column, refTable, refColumn } of CASCADE_FKS) {
            const name = `${table}_${column}_fkey`;
            await queryInterface.sequelize.query(
                `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`
            );
            await queryInterface.sequelize.query(
                `ALTER TABLE "${table}" ADD CONSTRAINT "${name}"
                 FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}")`
            );
        }
    },
};
