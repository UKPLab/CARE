'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Type 2: Remove firstName, lastName, creatorFirstName, creatorLastName
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 2,
      placeholderKey: ['firstName', 'lastName', 'creatorFirstName', 'creatorLastName']
    });
    
    // Type 3: Remove firstName, lastName
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 3,
      placeholderKey: ['firstName', 'lastName']
    });
    
    // Type 4: Remove description (no placeholders for document templates)
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 4,
      placeholderKey: 'description'
    });
    
    // Type 5: Remove description (no placeholders for document templates)
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 5,
      placeholderKey: 'description'
    });
    
    // Add missing placeholder: link for Type 3 (Email - Assignment)
    await queryInterface.bulkInsert('template_placeholder_mapping', [{
      templateType: 3,
      placeholderKey: 'link',
      placeholderLabel: 'Assignment Link',
      placeholderType: 'link',
      required: false,
      deleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  },

  async down(queryInterface, Sequelize) {
    // Revert: Delete the link placeholder for Type 3
    await queryInterface.bulkDelete('template_placeholder_mapping', {
      templateType: 3,
      placeholderKey: 'link'
    });
    
    // Revert: Re-add removed placeholders
    const revertPlaceholders = [
      // Type 2
      { templateType: 2, placeholderKey: 'firstName', placeholderLabel: 'First Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'lastName', placeholderLabel: 'Last Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'creatorFirstName', placeholderLabel: 'Creator First Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'creatorLastName', placeholderLabel: 'Creator Last Name', placeholderType: 'text', required: false },
      // Type 3
      { templateType: 3, placeholderKey: 'firstName', placeholderLabel: 'First Name', placeholderType: 'text', required: false },
      { templateType: 3, placeholderKey: 'lastName', placeholderLabel: 'Last Name', placeholderType: 'text', required: false },
      // Type 4
      { templateType: 4, placeholderKey: 'description', placeholderLabel: 'Description', placeholderType: 'text', required: false },
      // Type 5
      { templateType: 5, placeholderKey: 'description', placeholderLabel: 'Description', placeholderType: 'text', required: false },
    ];
    
    await queryInterface.bulkInsert(
      'template_placeholder_mapping',
      revertPlaceholders.map(ph => ({
        ...ph,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }
};
