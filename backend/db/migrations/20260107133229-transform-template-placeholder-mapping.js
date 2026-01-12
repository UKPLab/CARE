'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Remove foreign key constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE template_placeholder_mapping 
      DROP CONSTRAINT IF EXISTS template_placeholder_mapping_templateId_fkey;
    `);

    // Step 2: Remove templateId column
    await queryInterface.removeColumn('template_placeholder_mapping', 'templateId');

    // Step 3: Add templateType column
    await queryInterface.addColumn('template_placeholder_mapping', 'templateType', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Step 4: Seed placeholders per template type
    const placeholders = [
      // Type 1: Email - General
      { templateType: 1, placeholderKey: 'username', placeholderLabel: 'Username', placeholderType: 'text', required: false },
      { templateType: 1, placeholderKey: 'firstName', placeholderLabel: 'First Name', placeholderType: 'text', required: false },
      { templateType: 1, placeholderKey: 'lastName', placeholderLabel: 'Last Name', placeholderType: 'text', required: false },
      { templateType: 1, placeholderKey: 'link', placeholderLabel: 'Link', placeholderType: 'link', required: false },
      
      // Type 2: Email - Study Session
      { templateType: 2, placeholderKey: 'username', placeholderLabel: 'Username', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'firstName', placeholderLabel: 'First Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'lastName', placeholderLabel: 'Last Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'creatorUsername', placeholderLabel: 'Creator Username', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'creatorFirstName', placeholderLabel: 'Creator First Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'creatorLastName', placeholderLabel: 'Creator Last Name', placeholderType: 'text', required: false },
      { templateType: 2, placeholderKey: 'link', placeholderLabel: 'Study Link', placeholderType: 'link', required: false },
      
      // Type 3: Email - Assignment
      { templateType: 3, placeholderKey: 'username', placeholderLabel: 'Username', placeholderType: 'text', required: false },
      { templateType: 3, placeholderKey: 'firstName', placeholderLabel: 'First Name', placeholderType: 'text', required: false },
      { templateType: 3, placeholderKey: 'lastName', placeholderLabel: 'Last Name', placeholderType: 'text', required: false },
      { templateType: 3, placeholderKey: 'assignmentType', placeholderLabel: 'Assignment Type', placeholderType: 'text', required: false },
      { templateType: 3, placeholderKey: 'assignmentName', placeholderLabel: 'Assignment Name', placeholderType: 'text', required: false },
      
      // Type 4: Document - General (temporary: description placeholder, to be handled later)
      { templateType: 4, placeholderKey: 'description', placeholderLabel: 'Description', placeholderType: 'text', required: false },
      
      // Type 5: Document - Study (temporary: description placeholder, to be handled later)
      { templateType: 5, placeholderKey: 'description', placeholderLabel: 'Description', placeholderType: 'text', required: false },
    ];

    await queryInterface.bulkInsert(
      'template_placeholder_mapping',
      placeholders.map(ph => ({
        ...ph,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Delete seeded placeholders
    await queryInterface.bulkDelete(
      'template_placeholder_mapping',
      {
        templateType: [1, 2, 3, 4, 5]
      },
      {}
    );

    // Step 2: Remove templateType column
    await queryInterface.removeColumn('template_placeholder_mapping', 'templateType');

    // Step 3: Add templateId column back
    await queryInterface.addColumn('template_placeholder_mapping', 'templateId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null since we're reverting
      references: {
        model: 'template',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },
};
