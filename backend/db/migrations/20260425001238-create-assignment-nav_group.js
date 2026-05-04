'use strict';

const NEW_GROUP = { name: 'Assignment', icon: 'list-check', order: 4 };

// Groups that need to be shifted up to make room for the new Assignment group
const SHIFTED_GROUPS = [
  { name: 'Settings', newOrder: 6, oldOrder: 4 },
  { name: 'AI', newOrder: 5, oldOrder: 5 },
];

const ELEMENT_TO_GROUP = {
  Assignments: { group: 'Assignment', order: 1, previousGroup: 'Default' },
  Submissions: { group: 'Assignment', order: 2, previousGroup: 'Study' },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Shift existing groups to make room
    for (const group of SHIFTED_GROUPS) {
      await queryInterface.bulkUpdate(
        'nav_group',
        { order: group.newOrder, updatedAt: now },
        { name: group.name }
      );
    }

    await queryInterface.bulkInsert('nav_group', [{
      name: NEW_GROUP.name,
      icon: NEW_GROUP.icon,
      order: NEW_GROUP.order,
      admin: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }]);

    for (const [elementName, config] of Object.entries(ELEMENT_TO_GROUP)) {
      const groupId = await queryInterface.rawSelect(
        'nav_group',
        { where: { name: config.group } },
        ['id']
      );

      if (groupId) {
        await queryInterface.bulkUpdate(
          'nav_element',
          { groupId, order: config.order, updatedAt: now },
          { name: elementName }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const now = new Date();

    for (const [elementName, config] of Object.entries(ELEMENT_TO_GROUP)) {
      const groupId = await queryInterface.rawSelect(
        'nav_group',
        { where: { name: config.previousGroup } },
        ['id']
      );

      if (groupId) {
        await queryInterface.bulkUpdate(
          'nav_element',
          { groupId, updatedAt: now },
          { name: elementName }
        );
      }
    }

    await queryInterface.bulkDelete('nav_group', { name: NEW_GROUP.name });

    // Restore shifted groups to their original order
    for (const group of SHIFTED_GROUPS) {
      await queryInterface.bulkUpdate(
        'nav_group',
        { order: group.oldOrder, updatedAt: now },
        { name: group.name }
      );
    }
  },
};
