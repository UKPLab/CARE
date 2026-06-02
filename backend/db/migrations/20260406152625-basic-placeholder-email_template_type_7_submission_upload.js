'use strict';

/** @type {import('sequelize-cli').Migration} */

const placeholders = [
  {
    type: 7,
    placeholderKey: 'username',
    placeholderLabel: 'Recipient username',
    placeholderType: 'text',
    placeholderDescription: 'Recipient username (assignment owner or submitter).',
  },
  {
    type: 7,
    placeholderKey: 'assignmentName',
    placeholderLabel: 'Assignment name',
    placeholderType: 'text',
    placeholderDescription: 'Name of the assignment.',
    required: true,
  },
  {
    type: 7,
    placeholderKey: 'eventType',
    placeholderLabel: 'Upload event',
    placeholderType: 'text',
    placeholderDescription: 'Lowercase: "uploaded" or "reuploaded".',
  },
  {
    type: 7,
    placeholderKey: 'assignmentId',
    placeholderLabel: 'Assignment ID',
    placeholderType: 'text',
    placeholderDescription: 'Internal assignment identifier.',
  },
  {
    type: 7,
    placeholderKey: 'submissionId',
    placeholderLabel: 'Submission ID',
    placeholderType: 'text',
    placeholderDescription: 'Internal submission identifier.',
  },
  {
    type: 7,
    placeholderKey: 'timestamp',
    placeholderLabel: 'Upload timestamp',
    placeholderType: 'text',
    placeholderDescription: 'When the submission was uploaded.',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'placeholder',
      placeholders.map((p) => ({
        ...p,
        required: p.required === true,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('placeholder', { type: 7 }, {});
  },
};
