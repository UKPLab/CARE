'use strict';

const navElements = [
  {
    name: 'LLM Dashboard',
    groupId: 'Default',
    icon: 'robot',
    order: 15,
    admin: false,
    path: 'llm_dashboard',
    component: 'LlmDashboard',
  },
  {
    name: 'LLM Providers',
    groupId: 'Admin',
    icon: 'cloud',
    order: 11,
    admin: true,
    path: 'llm_providers',
    component: 'LlmProviders',
  },
];

const userRights = [
  {
    name: 'frontend.dashboard.llm_dashboard.view',
    description: 'Access to the LLM Dashboard (API keys, prompt templates, usage log)',
  },
  {
    name: 'frontend.dashboard.llm_providers.view',
    description: 'Access to the LLM Providers admin page',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'user_right',
      userRights.map((right) => ({
        ...right,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );

    await queryInterface.bulkInsert(
      'nav_element',
      await Promise.all(
        navElements.map(async (t) => {
          const groupId = await queryInterface.rawSelect('nav_group', {
            where: { name: t.groupId },
          }, ['id']);

          return {
            ...t,
            groupId: groupId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        })
      ),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('nav_element', {
      name: navElements.map((t) => t.name),
    }, {});

    await queryInterface.bulkDelete('user_right', {
      name: userRights.map((r) => r.name),
    }, {});
  },
};
