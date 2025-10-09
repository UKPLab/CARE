'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add tagSetId column to study table if it does not yet exist
    // Using a separate addColumn so it can be safely rolled back
    await queryInterface.addColumn('study', 'tagSetId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'tag_set',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('study', 'tagSetId');
  }
};
