'use strict';

/**
 * Ensure one active metadata row per (documentId, metaKey).
 *
 * - First, deduplicate existing active rows using last-write-wins semantics.
 * - Then, add a partial unique index for active rows only (deleted = false).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "documentId", "metaKey"
            ORDER BY "updatedAt" DESC NULLS LAST, id DESC
          ) AS rn
        FROM "document_metadata"
        WHERE deleted = false
      )
      DELETE FROM "document_metadata" dm
      USING ranked r
      WHERE dm.id = r.id
        AND r.rn > 1;
    `);

    await queryInterface.addIndex('document_metadata', ['documentId', 'metaKey'], {
      unique: true,
      where: {
        deleted: false,
      },
      name: 'document_metadata_active_unique_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'document_metadata',
      'document_metadata_active_unique_idx'
    );
  },
};
