'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add placeholderDescription column to template_placeholder_mapping,
 * remove creatorUsername for Type 2, and update placeholderLabel and placeholderDescription
 * for all current placeholders.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add placeholderDescription column (TEXT, nullable)
    await queryInterface.addColumn('template_placeholder_mapping', 'placeholderDescription', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 2. Remove creatorUsername for Type 2 (Email - Study Session)
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 2,
      placeholderKey: 'creatorUsername',
    });

    // 3. Update placeholderLabel and placeholderDescription for each row
    const updates = [
      [1, 'username', 'Recipient username', 'The login name of the person receiving the email. For password reset, verification, or registration emails this is the user whose account the email is about.'],
      [1, 'firstName', 'Recipient first name', 'The first name of the person receiving the email.'],
      [1, 'lastName', 'Recipient last name', 'The last name of the person receiving the email.'],
      [1, 'link', 'Link', 'The URL included in the email (e.g. password reset, verification, or registration). Format depends on the email type.'],
      [2, 'username', 'Recipient username', 'The person receiving this email. For session start, session finish, and study-closed notifications this is always the submission owner.'],
      [2, 'link', 'Review link', 'The URL to open the review (read-only). Used for session start and session finish; in study-closed emails ~link~ is not resolved and appears as-is.'],
      [3, 'username', 'Recipient username', 'The login name of the reviewer who is assigned to the task.'],
      [3, 'assignmentType', 'Assignment type', 'How the work is assigned: "document" (review by document) or "submission" (review by submission).'],
      [3, 'assignmentName', 'Assignment or study name', 'The name of the assignment or study the reviewer is assigned to.'],
      [3, 'link', 'Assignment link', 'The URL for the reviewer to open and start their review session. They must use this link to begin the assigned task.'],
    ];

    for (const [templateType, placeholderKey, placeholderLabel, placeholderDescription] of updates) {
      await queryInterface.sequelize.query(
        `UPDATE template_placeholder_mapping
         SET "placeholderLabel" = $1, "placeholderDescription" = $2
         WHERE "templateType" = $3 AND "placeholderKey" = $4 AND ("deleted" = false OR "deleted" IS NULL)`,
        { bind: [placeholderLabel, placeholderDescription, templateType, placeholderKey] }
      );
    }
  },

  /**
   * Revert: remove placeholderDescription, re-insert creatorUsername for Type 2,
   * and restore previous placeholderLabel values (placeholderDescription set to null before drop).
   */
  async down(queryInterface, Sequelize) {
    // 1. Restore previous placeholderLabel and set placeholderDescription to null
    const restore = [
      [1, 'username', 'Username'],
      [1, 'firstName', 'First Name'],
      [1, 'lastName', 'Last Name'],
      [1, 'link', 'Link'],
      [2, 'username', 'Username'],
      [2, 'link', 'Study Link'],
      [3, 'username', 'Username'],
      [3, 'assignmentType', 'Assignment Type'],
      [3, 'assignmentName', 'Assignment Name'],
      [3, 'link', 'Assignment Link'],
    ];

    for (const [templateType, placeholderKey, placeholderLabel] of restore) {
      await queryInterface.sequelize.query(
        `UPDATE template_placeholder_mapping
         SET "placeholderLabel" = $1, "placeholderDescription" = NULL
         WHERE "templateType" = $2 AND "placeholderKey" = $3 AND ("deleted" = false OR "deleted" IS NULL)`,
        { bind: [placeholderLabel, templateType, placeholderKey] }
      );
    }

    // 2. Re-insert creatorUsername for Type 2
    await queryInterface.bulkInsert('template_placeholder_mapping', [{
      templateType: 2,
      placeholderKey: 'creatorUsername',
      placeholderLabel: 'Creator Username',
      placeholderType: 'text',
      required: false,
      deleted: false,
      deletedAt: null,
      placeholderDescription: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    // 3. Remove placeholderDescription column
    await queryInterface.removeColumn('template_placeholder_mapping', 'placeholderDescription');
  },
};
