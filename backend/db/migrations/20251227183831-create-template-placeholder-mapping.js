'use strict';

/**
 * Create template_placeholder_mapping table and seed placeholder definitions
 * for all template types.
 *
 * @type {import('sequelize-cli').Migration}
 */

const placeholders = [
  // Type 1: Email - General
  { templateType: 1, placeholderKey: 'username', placeholderLabel: 'Recipient username', placeholderType: 'text', placeholderDescription: 'Username of the email recipient.' },
  { templateType: 1, placeholderKey: 'firstName', placeholderLabel: 'Recipient first name', placeholderType: 'text', placeholderDescription: 'First name of the email recipient.' },
  { templateType: 1, placeholderKey: 'lastName', placeholderLabel: 'Recipient last name', placeholderType: 'text', placeholderDescription: 'Last name of the email recipient.' },
  { templateType: 1, placeholderKey: 'link', placeholderLabel: 'Link', placeholderType: 'link', placeholderDescription: 'Action link in the email (e.g. reset or verification URL).', required: true },

  // Type 2: Email - Study Session
  { templateType: 2, placeholderKey: 'username', placeholderLabel: 'Recipient username', placeholderType: 'text', placeholderDescription: 'Submission owner receiving this session email.' },
  { templateType: 2, placeholderKey: 'link', placeholderLabel: 'Review link', placeholderType: 'link', placeholderDescription: 'Link to open the review in read-only mode.', required: true },

  // Type 3: Email - Assignment
  { templateType: 3, placeholderKey: 'username', placeholderLabel: 'Recipient username', placeholderType: 'text', placeholderDescription: 'Username of the assigned reviewer.' },
  { templateType: 3, placeholderKey: 'assignmentType', placeholderLabel: 'Assignment type', placeholderType: 'text', placeholderDescription: 'Whether the assignment is document or submission.' },
  { templateType: 3, placeholderKey: 'assignmentName', placeholderLabel: 'Assignment name', placeholderType: 'text', placeholderDescription: 'Name of the assignment or study.' },
  { templateType: 3, placeholderKey: 'link', placeholderLabel: 'Assignment link', placeholderType: 'link', placeholderDescription: 'Link to start the assigned review session.', required: true },

  // Type 6: Email - Study Close
  { templateType: 6, placeholderKey: 'username', placeholderLabel: 'Recipient username', placeholderType: 'text', placeholderDescription: 'Username of the session owner with an open session at study close.' },
  { templateType: 6, placeholderKey: 'studyName', placeholderLabel: 'Study name', placeholderType: 'text', placeholderDescription: 'Name of the study that was closed.', required: true },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_placeholder_mapping', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      templateType: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      placeholderKey: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      placeholderLabel: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      placeholderType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      placeholderDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Seed placeholder definitions
    await queryInterface.bulkInsert(
      'template_placeholder_mapping',
      placeholders.map((p) => ({
        ...p,
        required: p.required === true,
        deleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('template_placeholder_mapping');
  },
};
