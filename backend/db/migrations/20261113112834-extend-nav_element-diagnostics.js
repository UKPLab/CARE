'use strict';

/**
 * Add the read-only Diagnostics page (PostgreSQL health, #526) to the Settings nav group.
 * Admin-only: `admin: true` hides it from everyone else, and the `diagnosticsGet`
 * socket checks isAdmin() itself.
 *
 * @author Akash Gundapuneni
 */

const navElements = [
  {
    name: 'Diagnostics',
    groupId: 'Settings',
    icon: 'heart-pulse',
    order: 5,
    admin: true,
    path: 'diagnostics',
    component: 'Diagnostics',
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
