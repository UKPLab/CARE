"use strict";

/**
 * Migration script to extend the document table by adding a new column.
 * This script adds the 'originalFilename' column to the 'document' table.
 * @requires queryInterface
 * @requires Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("document", "originalFilename", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  /**
   * Migration script to revert the changes made in the up method.
   * This script removes the 'originalFilename' column from the 'document' table.
   * @param {*} queryInterface 
   * @param {*} Sequelize 
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("document", "originalFilename");
  },
};