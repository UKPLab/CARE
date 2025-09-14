'use strict';

module.exports = {
  /**
   * Run the migration – transform document_data table to use composite primary key
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('document_data', 'id');

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS document_data_unique_idx 
      ON document_data (
        COALESCE("documentId", -1), 
        COALESCE("studySessionId", -1), 
        COALESCE("studyStepId", -1), 
        "key"
      )
    `);
  },

  /**
   * Revert: restore original table structure with auto-increment id
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS document_data_unique_idx');

    await queryInterface.addColumn('document_data', 'id', {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    });
  },
};