'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trace', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('trace', 'userId');
  },
};