'use strict';

const settings = [
  {
    key: 'service.llm.enabled',
    value: 'true',
    type: 'boolean',
    description: 'Enable or disable the LLM service for direct API calls',
    onlyAdmin: false,
  },
  {
    key: 'service.llm.defaultProvider',
    value: 'openai',
    type: 'string',
    description: 'Default LLM provider slug when no user key is available',
    onlyAdmin: true,
  },
  {
    key: 'service.llm.maxTokensPerRequest',
    value: '4096',
    type: 'number',
    description: 'Maximum output tokens allowed per single LLM request',
    onlyAdmin: true,
  },
  {
    key: 'service.llm.requestTimeout',
    value: '120000',
    type: 'number',
    description: 'Timeout in ms for LLM API requests',
    onlyAdmin: true,
  },
  {
    key: 'service.llm.systemApiKeyProvider',
    value: '',
    type: 'string',
    description: 'System-level fallback API key provider slug (leave empty to disable)',
    onlyAdmin: true,
  },
  {
    key: 'service.llm.systemApiKey',
    value: '',
    type: 'encrypted',
    description: 'System-level fallback API key. Used when users have no personal key.',
    onlyAdmin: true,
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'setting',
      settings.map((s) => ({
        ...s,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('setting', {
      key: settings.map((s) => s.key),
    }, {});
  },
};
