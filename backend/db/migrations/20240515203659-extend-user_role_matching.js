'use strict';

const User = require('../models/user'); // Adjust the path as necessary

module.exports = {
  async up(queryInterface, Sequelize) {
    // Transfer data from sysrole column to user_role_matching table
    const users = await User.findAll();

    for (const user of users) {
      await queryInterface.bulkInsert('user_role_matching', [
        {
          userId: user.id,
          userRoleName: user.sysrole,
          deleted: user.deleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        },
      ]);
    }

    // Remove the sysrole column from the user table
    await queryInterface.removeColumn('user', 'sysrole');
  },

  async down(queryInterface, Sequelize) {
    // Add back the sysrole column to the user table
    await queryInterface.addColumn('user', 'sysrole', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'sysrole',
        key: 'name',
      },
    });

    // Fill in the sysrole column in the user table again
    const userRoleMatchings = await queryInterface.sequelize.query(
      'SELECT * FROM user_role_matching',
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    for (const matching of userRoleMatchings) {
      await User.update(
        { sysrole: matching.userRoleName },
        { where: { id: matching.userId } }
      );
    }
  },
};
