'use strict';

/**
 * Add Admin Tools page to the Settings nav group.
 * Extensible dashboard surface for admin file/system utilities.
 *
 * @author Mohammad Elwan
 */

const navElements = [
  {
    name: 'Admin Tools',
    groupId: 'Settings',
    icon: 'tools',
    order: 4,
    admin: true,
    path: 'admin_tools',
    component: 'AdminTools',
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      'nav_element',
      await Promise.all(
        navElements.map(async (element) => {
          const groupId = await queryInterface.rawSelect(
            'nav_group',
            { where: { name: element.groupId } },
            ['id']
          );

          return {
            ...element,
            groupId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        })
      ),
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'nav_element',
      { name: navElements.map((element) => element.name) },
      {}
    );
  },
};
