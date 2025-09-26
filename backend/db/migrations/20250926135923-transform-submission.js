"use strict";

module.exports = {
  /**
   * Rename validationDocumentId to configurationId and update foreign key reference
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    // Remove existing foreign key constraint
    await queryInterface.removeConstraint("submission", "submission_validationDocumentId_fkey");

    // Rename the column
    await queryInterface.renameColumn("submission", "validationDocumentId", "configurationId");

    // Add new foreign key constraint to configuration table
    await queryInterface.addConstraint("submission", {
      fields: ["configurationId"],
      type: "foreign key",
      name: "submission_configurationId_fkey",
      references: {
        table: "configuration",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  /**
   * Rename back and restore original foreign key
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async down(queryInterface, Sequelize) {
    // Remove the foreign key to configuration
    await queryInterface.removeConstraint("submission", "submission_configurationId_fkey");

    // Rename column back
    await queryInterface.renameColumn("submission", "configurationId", "validationDocumentId");

    // Restore original foreign key to document table
    await queryInterface.addConstraint("submission", {
      fields: ["validationDocumentId"],
      type: "foreign key",
      name: "submission_validationDocumentId_fkey",
      references: {
        table: "document",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
