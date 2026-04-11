'use strict';

/** @type {import('sequelize-cli').Migration} */

const placeholders = [
  {
    type: 7,
    placeholderKey: 'username',
    placeholderLabel: 'Recipient username',
    placeholderType: 'text',
    placeholderDescription: 'Assignment owner receiving this notification.',
  },
  {
    type: 7,
    placeholderKey: 'assignmentName',
    placeholderLabel: 'Assignment name',
    placeholderType: 'text',
    placeholderDescription: 'Name of the assignment.',
  },
  {
    type: 7,
    placeholderKey: 'link',
    placeholderLabel: 'Submission link',
    placeholderType: 'link',
    placeholderDescription: 'Link to open the submission in the dashboard.',
    required: true,
  },
  {
    type: 7,
    placeholderKey: 'eventType',
    placeholderLabel: 'Upload event',
    placeholderType: 'text',
    placeholderDescription: 'Whether the submission was first uploaded or reuploaded.',
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
