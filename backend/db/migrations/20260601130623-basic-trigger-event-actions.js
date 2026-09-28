'use strict';

const triggerEvents = [
  {
    name: 'submission.uploaded',
    enabled: true,
    configuration: {
      label: 'triggers.metadata.events.assignment.label',
      description: 'triggers.metadata.events.assignment.description',
      provides: ['userId', 'submissionId', 'projectId', 'assignmentId'],
      formSchema: [
        {
          key: 'assignmentId',
          label: 'triggers.metadata.events.assignment.fields.assignment',
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
      label: 'triggers.metadata.actions.email.label',
      description: 'triggers.metadata.actions.email.description',
      requires: ['userId'],
      handler: 'send_email',
      formSchema: [
        {
          key: 'recipient',
          label: 'triggers.metadata.actions.email.fields.recipient',
          type: 'select',
          required: true,
          options: [
            { name: 'triggers.metadata.actions.email.options.uploader', value: 'uploader' },
            { name: 'triggers.metadata.actions.email.options.admins', value: 'admins' },
          ],
        },
        {
          key: 'templateId',
          label: 'triggers.metadata.actions.email.fields.template',
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
      label: 'triggers.metadata.actions.aiPreprocessing.label',
      description: 'triggers.metadata.actions.aiPreprocessing.description',
      requires: ['submissionId'],
      handler: 'nlp_preprocess',
      componentSchema: [
        {
          type: 'skillSelector',
          key: 'skillName',
          required: true,
        },
        {
          type: 'inputMap',
          key: 'inputMappings',
          skillKey: 'skillName',
          studyBased: false,
          required: true,
          requireTableBasedInput: true,
          tableSelectionSource: 'eventContext',
          contextKey: 'submissionId',
        },
        {
          type: 'inputGroup',
          key: 'baseFiles',
          baseFileParameterKey: 'baseFileParameter',
          selectedFilesKey: 'selectedFiles',
          visibleWhen: 'requiresValidation',
          required: true,
        },
      ],
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
