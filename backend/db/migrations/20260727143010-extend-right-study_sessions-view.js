'use strict';

/**
 * Restore frontend.dashboard.study_sessions.view so Sidebar.vue right checks
 * match nav_element.path ("study_sessions"). Migration 20260417150912 renamed
 * the right to my_sessions.view without updating the nav path.
 */
const renamedRights = [
  {
    oldName: "frontend.dashboard.my_sessions.view",
    newName: "frontend.dashboard.study_sessions.view",
    description: "access to view study sessions in the dashboard",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure ON UPDATE CASCADE so renaming user_right propagates to role_right_matching
    await queryInterface.removeConstraint('role_right_matching', 'role_right_matching_userRightName_fkey');
    await queryInterface.addConstraint('role_right_matching', {
      fields: ['userRightName'],
      type: 'foreign key',
      name: 'role_right_matching_userRightName_fkey',
      references: { table: 'user_right', field: 'name' },
      onUpdate: 'CASCADE',
      onDelete: 'NO ACTION',
    });

    for (const r of renamedRights) {
      await queryInterface.bulkUpdate(
        "user_right",
        { name: r.newName, description: r.description, updatedAt: new Date() },
        { name: r.oldName }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    for (const r of renamedRights) {
      await queryInterface.bulkUpdate(
        "user_right",
        {
          name: r.oldName,
          description: "access to view my sessions in the dashboard",
          updatedAt: new Date(),
        },
        { name: r.newName }
      );
    }
  }
};
