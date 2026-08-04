'use strict';

/**
 * Force dashboard nav_group order so Settings is last.
 * Older DBs can still have Settings at order 4 (above AI).
 */
const GROUP_ORDERS = [
  { name: 'Home', order: 1 },
  { name: 'Study', order: 2 },
  { name: 'Manage', order: 3 },
  { name: 'Assignment', order: 4 },
  { name: 'AI', order: 5 },
  { name: 'Settings', order: 6 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    for (const group of GROUP_ORDERS) {
      await queryInterface.bulkUpdate(
        'nav_group',
        { order: group.order, updatedAt: now },
        { name: group.name }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkUpdate(
      'nav_group',
      { order: 4, updatedAt: now },
      { name: 'Settings' }
    );
  }
};
