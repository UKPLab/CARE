'use strict';

const { Op } = require('sequelize');
const Sysrole = require('../models/sysrole'); // Adjust the path as necessary

module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch two rows from sysrole table where the names are regular and admin
    const selectedSysroles = await Sysrole.findAll({
      where: {
        name: {
          [Op.in]: ['regular', 'admin'],
        },
      },
    });

    for (const sysrole of selectedSysroles) {
      await queryInterface.bulkInsert('user_role', [
        {
          name: sysrole.name,
          description: sysrole.description,
          deleted: sysrole.deleted,
          createdAt: sysrole.createdAt,
          updatedAt: sysrole.updatedAt,
          deletedAt: sysrole.deletedAt,
        },
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user_role', {
      name: { [Op.in]: ['regular', 'admin'] },
    });
  },
};
