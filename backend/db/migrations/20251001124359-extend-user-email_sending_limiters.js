'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user', 'lastPasswordResetEmailSent', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    
    await queryInterface.addColumn('user', 'lastVerificationEmailSent', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user', 'lastPasswordResetEmailSent');
    await queryInterface.removeColumn('user', 'lastVerificationEmailSent');
  }
};