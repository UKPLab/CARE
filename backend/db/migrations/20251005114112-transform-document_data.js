'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(`
            ALTER TABLE "document_data"
                ADD COLUMN "conflict_key" text
                    GENERATED ALWAYS AS (
                        coalesce("userId"::text, '0') || '|' ||
                        coalesce("documentId"::text, '0') || '|' ||
                        coalesce("studySessionId"::text, '0') || '|' ||
                        coalesce("studyStepId"::text, '0') || '|' ||
                        coalesce("key", '')
                        ) STORED
        `);

        await queryInterface.addConstraint('document_data', {
            fields: ['conflict_key'],
            type: 'unique',
            name: 'document_data_conflict_key_uk'
        });

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.removeConstraint('document_data', 'document_data_conflict_key_uk').catch(() => {
        });
        await queryInterface.sequelize.query(`
            ALTER TABLE "document_data" DROP COLUMN IF EXISTS "conflict_key"
        `);
    }
};