'use strict';

const navElements = [
  {
    name: 'API Keys',
    groupId: 'Default',
    icon: 'key',
    order: 15,
    admin: false,
    path: 'api_keys',
    component: 'LlmDashboard',
  },
  {
    name: 'Models',
    groupId: 'Default',
    icon: 'robot',
    order: 16,
    admin: false,
    path: 'models',
    component: 'LlmProviders',
  },
];

const userRights = [
  {
    name: 'frontend.dashboard.api_keys.view',
    description: 'Access to the API Keys dashboard',
  },
  {
    name: 'frontend.dashboard.models.view',
    description: 'Access to the Models dashboard',
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
