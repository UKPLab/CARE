'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Transform Type 2 placeholder descriptions to remove study-closed references.
 * Type 2 is for session start/finish only, not study close (which is Type 6).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Fix Type 2 placeholder descriptions (remove study-closed references)
    const type2Updates = [
      [
        2,
        'username',
        'Recipient username',
        'The person receiving this email. For session start and session finish notifications this is always the submission owner.'
      ],
      [
        2,
        'link',
        'Review link',
        'The URL to open the review (read-only). Used for session start and session finish.'
      ],
    ];

    for (const [templateType, placeholderKey, placeholderLabel, placeholderDescription] of type2Updates) {
      await queryInterface.sequelize.query(
        `UPDATE template_placeholder_mapping
         SET "placeholderLabel" = $1, "placeholderDescription" = $2
         WHERE "templateType" = $3 AND "placeholderKey" = $4 AND ("deleted" = false OR "deleted" IS NULL)`,
        { bind: [placeholderLabel, placeholderDescription, templateType, placeholderKey] }
      );
    }
  },

  /**
   * Revert: restore previous descriptions
   */
  async down(queryInterface, Sequelize) {
    // Restore Type 2 placeholder descriptions with study-closed references
    const type2Restore = [
      [
        2,
        'username',
        'Recipient username',
        'The person receiving this email. For session start, session finish, and study-closed notifications this is always the submission owner.'
      ],
      [
        2,
        'link',
        'Review link',
        'The URL to open the review (read-only). Used for session start and session finish; in study-closed emails ~link~ is not resolved and appears as-is.'
      ],
    ];

    for (const [templateType, placeholderKey, placeholderLabel, placeholderDescription] of type2Restore) {
      await queryInterface.sequelize.query(
        `UPDATE template_placeholder_mapping
         SET "placeholderLabel" = $1, "placeholderDescription" = $2
         WHERE "templateType" = $3 AND "placeholderKey" = $4 AND ("deleted" = false OR "deleted" IS NULL)`,
        { bind: [placeholderLabel, placeholderDescription, templateType, placeholderKey] }
      );
    }
  },
};
