'use strict';

/**
 * The July 2026 nav_group order migration was edited after it had already
 * run, so existing databases still keep Settings and Triggers on the same
 * order. Settings stays last.
 */
const GROUP_ORDERS = [
  { name: 'Triggers', order: 6 },
  { name: 'Settings', order: 7 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const group of GROUP_ORDERS) {
      await queryInterface.bulkUpdate(
        'nav_group',
        { order: group.order, updatedAt: now },
        { name: group.name }
      );
    }
  },

  async down(queryInterface) {
    const now = new Date();

    await queryInterface.bulkUpdate(
      'nav_group',
      { order: 6, updatedAt: now },
      { name: 'Settings' }
    );
  },
};
