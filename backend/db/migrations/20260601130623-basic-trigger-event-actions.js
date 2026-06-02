'use strict';

const triggerEvents = [
  {
    name: 'submission.uploaded',
    enabled: true,
    configuration: {
      label: 'Assignment',
      description: 'Fires when a student uploads a submission for a selected assignment.',
      provides: ['userId', 'submissionId', 'projectId', 'assignmentId'],
      formSchema: [
        {
          key: 'assignmentId',
          label: 'Assignment',
          type: 'select',
          required: true,
          optionsSource: {
            table: 'assignment',
            labelKey: 'name',
            valueKey: 'id',
            filter: { disable: false, parentAssignmentId: null },
            filterFromForm: { projectId: 'projectId' },
          },
        },
      ],
    },
  },
];

const triggerActions = [
  {
    name: 'Email notification',
    enabled: true,
    configuration: {
      label: 'Send an email',
      description: 'Sends an email to a recipient derived from the event context.',
      requires: ['userId'],
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
          required: true,
          optionsSource: {
            table: 'template',
            labelKey: 'name',
            valueKey: 'id',
            filter: { type: 3 },
          },
        },
      ],
    },
  },
  {
    name: 'AI Preprocessing',
    enabled: true,
    configuration: {
      label: 'AI Preprocessing',
      description:
        'Runs an NLP skill on the uploaded submission with the same skill, input mapping, and base file options as Dashboard → Submissions → Apply Skills. Results are stored in document_data.',
      requires: ['submissionId'],
      handler: 'nlp_preprocess',
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
