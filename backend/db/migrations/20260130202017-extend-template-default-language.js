'use strict';

/**
 * Add defaultLanguage column to template table for multi-language support.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('template', 'defaultLanguage', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'en',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('template', 'defaultLanguage');
  },
};
