'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Set emailVerified to true for system users
     */
    await queryInterface.bulkUpdate('user', 
      { emailVerified: true },
    );
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revert emailVerified to false for system users
     */
    await queryInterface.bulkUpdate('user', 
      { emailVerified: false },
    );
  }
};
