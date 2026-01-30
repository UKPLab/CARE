'use strict';

/**
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('template_edit', 'language', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `UPDATE template_edit SET language = 'en' WHERE language IS NULL`
    );

    await queryInterface.changeColumn('template_edit', 'language', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('template_edit', 'language');
  },
};
