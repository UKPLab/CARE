'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Shorten placeholder descriptions for email templates to concise one-line summaries.
 *
 * Affects:
 * - Type 1: Email - General
 * - Type 2: Email - Study Session
 * - Type 3: Email - Assignment
 * - Type 6: Email - Study Close
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const updates = [
      // Type 1: Email - General
      [
        1,
        'username',
        'Recipient username',
        'Username of the email recipient.'
      ],
      [
        1,
        'firstName',
        'Recipient first name',
        'First name of the email recipient.'
      ],
      [
        1,
        'lastName',
        'Recipient last name',
        'Last name of the email recipient.'
      ],
      [
        1,
        'link',
        'Link',
        'Action link in the email (e.g. reset or verification URL).'
      ],

      // Type 2: Email - Study Session
      [
        2,
        'username',
        'Recipient username',
        'Submission owner receiving this session email.'
      ],
      [
        2,
        'link',
        'Review link',
        'Link to open the review in read-only mode.'
      ],

      // Type 3: Email - Assignment
      [
        3,
        'username',
        'Recipient username',
        'Username of the assigned reviewer.'
      ],
      [
        3,
        'assignmentType',
        'Assignment type',
        'Whether the assignment is document or submission.'
      ],
      [
        3,
        'assignmentName',
        'Assignment name',
        'Name of the assignment or study.'
      ],
      [
        3,
        'link',
        'Assignment link',
        'Link to start the assigned review session.'
      ],

      // Type 6: Email - Study Close
      [
        6,
        'username',
        'Recipient username',
        'Username of the session owner with an open session at study close.'
      ],
      [
        6,
        'studyName',
        'Study name',
        'Name of the study that was closed.'
      ],
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
   * Revert to the more detailed descriptions that existed before this transform.
   * For Type 2, we revert to the values from migration 20260126151457.
   * For Types 1, 3, 6 we revert to the values from 20260118181112 / 20260126132007.
   */
  async down(queryInterface, Sequelize) {
    const restore = [
      // Type 1: Email - General (from 20260118181112)
      [
        1,
        'username',
        'Recipient username',
        'The login name of the person receiving the email. For password reset, verification, or registration emails this is the user whose account the email is about.'
      ],
      [
        1,
        'firstName',
        'Recipient first name',
        'The first name of the person receiving the email.'
      ],
      [
        1,
        'lastName',
        'Recipient last name',
        'The last name of the person receiving the email.'
      ],
      [
        1,
        'link',
        'Link',
        'The URL included in the email (e.g. password reset, verification, or registration). Format depends on the email type.'
      ],

      // Type 2: Email - Study Session (from 20260126151457)
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

      // Type 3: Email - Assignment (from 20260118181112)
      [
        3,
        'username',
        'Recipient username',
        'The login name of the reviewer who is assigned to the task.'
      ],
      [
        3,
        'assignmentType',
        'Assignment type',
        'How the work is assigned: \"document\" (review by document) or \"submission\" (review by submission).'
      ],
      [
        3,
        'assignmentName',
        'Assignment or study name',
        'The name of the assignment or study the reviewer is assigned to.'
      ],
      [
        3,
        'link',
        'Assignment link',
        'The URL for the reviewer to open and start their review session. They must use this link to begin the assigned task.'
      ],

      // Type 6: Email - Study Close (from 20260126132007)
      [
        6,
        'username',
        'Recipient username',
        'The username of the session owner who had an open session when the study was closed.'
      ],
      [
        6,
        'studyName',
        'Study name',
        'The name of the study that was closed.'
      ],
    ];

    for (const [templateType, placeholderKey, placeholderLabel, placeholderDescription] of restore) {
      await queryInterface.sequelize.query(
        `UPDATE template_placeholder_mapping
         SET "placeholderLabel" = $1, "placeholderDescription" = $2
         WHERE "templateType" = $3 AND "placeholderKey" = $4 AND ("deleted" = false OR "deleted" IS NULL)`,
        { bind: [placeholderLabel, placeholderDescription, templateType, placeholderKey] }
      );
    }
  },
};

