'use strict';

module.exports = {
  /**
   * Add submissionId column to document table
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document', 'submissionId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'submission',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  /**
   * Remove submissionId column from document table
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize')} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('document', 'submissionId');
  },
}; 