'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Add placeholder mappings for Type 6 (Email - Study Close).
 * Placeholders: username (session owner), studyName (study name).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert placeholder mappings for Type 6
    const placeholders = [
      {
        templateType: 6,
        placeholderKey: 'username',
        placeholderLabel: 'Recipient username',
        placeholderDescription: 'The username of the session owner who had an open session when the study was closed.',
        placeholderType: 'text',
        required: false,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        templateType: 6,
        placeholderKey: 'studyName',
        placeholderLabel: 'Study name',
        placeholderDescription: 'The name of the study that was closed.',
        placeholderType: 'text',
        required: false,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert('template_placeholder_mapping', placeholders);
  },

  /**
   * Remove placeholder mappings for Type 6.
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 6,
    });
  },
};
