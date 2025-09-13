'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Set emailVerified to true for system users (guest, admin, bot)
     */
    await queryInterface.bulkUpdate('user', 
      { emailVerified: true },
      {
        userName: {
          [Sequelize.Op.in]: ['guest', 'admin', 'Bot']
        }
      }
    );
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revert emailVerified to false for system users (guest, admin, bot)
     */
    await queryInterface.bulkUpdate('user', 
      { emailVerified: false },
      {
        userName: {
          [Sequelize.Op.in]: ['guest', 'admin', 'Bot']
        }
      }
    );
  }
};
