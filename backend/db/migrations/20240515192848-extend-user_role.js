'use strict';

const { Op } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch two rows from sysrole table where the names are regular and admin
    const selectedSysroles = await queryInterface.sequelize.query(
      'SELECT * FROM sysrole WHERE name IN (:names)',
      {
        replacements: { names: ['regular', 'admin'] },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    await queryInterface.bulkInsert(
      'user_role',
      await Promise.all(
        selectedSysroles.map(async (sysrole) => {
          return {
            name: sysrole.name,
            description: sysrole.description,
            deleted: sysrole.deleted,
            createdAt: sysrole.createdAt,
            updatedAt: sysrole.updatedAt,
            deletedAt: sysrole.deletedAt,
          };
        })
      )
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user_role', {
      name: { [Op.in]: ['regular', 'admin'] },
    });
  },
};
