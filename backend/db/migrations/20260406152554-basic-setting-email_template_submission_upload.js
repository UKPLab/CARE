'use strict';

/** @type {import('sequelize-cli').Migration} */

const settings = [
  {
    key: 'email.template.submissionUpload',
    value: '',
    type: 'number',
    description:
      'Template type for assignment submission upload/reupload emails to the assignment owner (Email - Submission upload). Leave empty to use default email.',
  },
  {
    key: 'email.template.submissionUploadConfirmation',
    value: '',
    type: 'number',
    description:
      'Template for submission upload confirmation to the submitter (Email - Submission upload). Leave empty to use default email.',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'setting',
      settings.map((t) => ({
        ...t,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('setting', { key: settings.map((t) => t.key) }, {});
  },
};
