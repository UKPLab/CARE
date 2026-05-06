'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Rename "Study Sessions" to "My Sessions"
    await queryInterface.bulkUpdate('nav_element',
      { name: 'My Sessions', updatedAt: new Date() },
      { name: 'Study Sessions' }
    );


    const groupId = await queryInterface.rawSelect(
      'nav_group',
      { where: { name: 'Default' } },
      ['id']
    );

    await queryInterface.bulkInsert('nav_element', [{
      name: 'Session Overview',
      groupId: groupId,
      icon: 'camera-video',
      order: 13,
      admin: false,
      path: 'session_overview',
      component: 'SessionOverview',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down (queryInterface, Sequelize) {
    // Remove "Session Overview"
    await queryInterface.bulkDelete('nav_element', { name: 'Session Overview' }, {});

    // Revert "My Sessions" back to "Study Sessions"
    await queryInterface.bulkUpdate('nav_element',
      { name: 'Study Sessions', updatedAt: new Date() },
      { name: 'My Sessions' }
    );
  }
};
