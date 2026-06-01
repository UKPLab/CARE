'use strict';

const triggerEvents = [
  {
    name: 'submission.uploaded',
    enabled: true,
    configuration: {
      label: 'When an assignment is submitted',
      description: 'Fires when a student uploads a submission.',
      provides: ['userId', 'submissionId', 'projectId'],
      tags: ['submission', 'assignment'],
    },
  },
];

const triggerActions = [
  {
    name: 'send_email',
    enabled: true,
    configuration: {
      label: 'Send an email',
      description: 'Sends an email to a recipient derived from the event context.',
      requires: ['userId'],
      tags: ['notification'],
      handler: 'send_email',
      formSchema: [
        {
          key: 'recipient',
          label: 'Send to',
          type: 'select',
          required: true,
          options: [
            { name: 'The uploader', value: 'uploader' },
            { name: 'All admins', value: 'admins' },
          ],
        },
        {
          key: 'templateId',
          label: 'Email template',
          type: 'select',
          required: false,
          optionsSource: {
            table: 'template',
            labelKey: 'name',
            valueKey: 'id',
            filter: { type: 3 },
            emptyOption: { name: 'No template (use subject/message below)', value: null },
          },
        },
        // { key: 'subject', label: 'Subject (used if no template)', type: 'text', required: false },
        // { key: 'message', label: 'Message (used if no template)', type: 'textarea', required: false },
      ],
    },
  },
  {
    name: 'nlp.preprocess',
    enabled: true,
    configuration: {
      label: 'Run preprocessing skill',
      description: 'Runs an NLP preprocessing skill; results are stored in document_data.',
      requires: ['submissionId'],
      tags: ['ai', 'preprocessing'],
      handler: 'nlp_preprocess',
      skillName: null,
      inputs: {
        document: { type: 'submission', from: '{{context.submissionId}}' },
      },
    },
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert(
      'trigger_event',
      triggerEvents.map((event) => ({
        name: event.name,
        enabled: event.enabled,
        configuration: JSON.stringify(event.configuration),
        deleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
      {}
    );

    await queryInterface.bulkInsert(
      'trigger_action',
      triggerActions.map((action) => ({
        name: action.name,
        enabled: action.enabled,
        configuration: JSON.stringify(action.configuration),
        deleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'trigger_action',
      { name: triggerActions.map((a) => a.name) },
      {}
    );

    await queryInterface.bulkDelete(
      'trigger_event',
      { name: triggerEvents.map((e) => e.name) },
      {}
    );
  },
};
