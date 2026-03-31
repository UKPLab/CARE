'use strict';

const providers = [
  {
    name: 'OpenAI',
    slug: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    enabled: true,
    models: JSON.stringify([
      { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'gpt-4.1', name: 'GPT-4.1', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', capabilities: ['text-generation', 'summarization', 'classification'] },
    ]),
  },
  {
    name: 'Anthropic',
    slug: 'anthropic',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    enabled: true,
    models: JSON.stringify([
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', capabilities: ['text-generation', 'summarization', 'classification'] },
    ]),
  },
  {
    name: 'Google',
    slug: 'google',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    enabled: true,
    models: JSON.stringify([
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['text-generation', 'summarization', 'classification'] },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['text-generation', 'summarization', 'classification'] },
    ]),
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'llm_provider',
      providers.map((p) => ({
        ...p,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('llm_provider', {
      slug: providers.map((p) => p.slug),
    }, {});
  },
};
