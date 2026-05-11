'use strict';

const NEW_GROUPS = [
  { name: 'Home', icon: 'house', order: 1 },
  { name: 'Study', icon: 'book', order: 2 },
  { name: 'Manage', icon: 'briefcase', order: 3 },
  { name: 'Settings', icon: 'sliders2', order: 4 },
  { name: 'AI', icon: 'robot', order: 5 },
];

const ELEMENT_TO_GROUP = {
  Home: { group: 'Home', order: 1 },
  Documents: { group: 'Home', order: 2 },
  Templates: { group: 'Home', order: 3 },
  Studies: { group: 'Study', order: 1 },
  'My Sessions': { group: 'Study', order: 2 },
  'Session Overview': { group: 'Study', order: 3 },
  Tags: { group: 'Study', order: 4 },
  Submissions: { group: 'Study', order: 5 },
  Projects: { group: 'Manage', order: 1 },
  Users: { group: 'Manage', order: 2 },
  'User Statistics': { group: 'Manage', order: 3 },
  Workflows: { group: 'Manage', order: 4 },
  'System Settings': { group: 'Settings', order: 1 },
  Logs: { group: 'Settings', order: 2 },
  Configurations: { group: 'Settings', order: 3 },
  'NLP Skills': { group: 'AI', order: 1 },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    for (const group of NEW_GROUPS) {
      await queryInterface.bulkInsert('nav_group', [{
        name: group.name,
        icon: group.icon,
        order: group.order,
        admin: false,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }]);
    }

    for (const [elementName, config] of Object.entries(ELEMENT_TO_GROUP)) {
      const groupId = await queryInterface.rawSelect(
        'nav_group',
        { where: { name: config.group } },
        ['id']
      );

      if (groupId) {
        await queryInterface.bulkUpdate(
          'nav_element',
          {
            groupId,
            order: config.order,
            updatedAt: now,
          },
          { name: elementName }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const now = new Date();

    const defaultId = await queryInterface.rawSelect(
      'nav_group',
      { where: { name: 'Default' } },
      ['id']
    );

    const adminId = await queryInterface.rawSelect(
      'nav_group',
      { where: { name: 'Admin' } },
      ['id']
    );

    const wasInAdmin = ['System Settings', 'Logs', 'Configurations', 'Users', 'User Statistics'];

    for (const elementName of Object.keys(ELEMENT_TO_GROUP)) {
      await queryInterface.bulkUpdate(
        'nav_element',
        {
          groupId: wasInAdmin.includes(elementName) ? adminId : defaultId,
          updatedAt: now,
        },
        { name: elementName }
      );
    }

    await queryInterface.bulkDelete('nav_group', {
      name: NEW_GROUPS.map(group => group.name),
    });
  },
};