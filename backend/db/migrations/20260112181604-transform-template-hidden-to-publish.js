'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Step 1: Add published column (default: false)
      await queryInterface.addColumn(
        'template',
        'published',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction }
      );

      // Step 2: Migrate data: published = !hidden (inverse logic)
      await queryInterface.sequelize.query(
        `UPDATE template SET published = NOT hidden WHERE hidden IS NOT NULL`,
        { transaction }
      );

      // Step 3: Remove hidden column
      await queryInterface.removeColumn('template', 'hidden', { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Step 1: Add hidden column back (default: false)
      await queryInterface.addColumn(
        'template',
        'hidden',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction }
      );

      // Step 2: Migrate data back: hidden = !published (inverse logic)
      await queryInterface.sequelize.query(
        `UPDATE template SET hidden = NOT published WHERE published IS NOT NULL`,
        { transaction }
      );

      // Step 3: Remove published column
      await queryInterface.removeColumn('template', 'published', { transaction });
    });
  },
};
