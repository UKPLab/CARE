'use strict';

const newRights = [
  {
    name: "frontend.dashboard.session_overview.view",
    description: "access to view session overview in the dashboard",
  },
];

const renamedRights = [
  {
    oldName: "frontend.dashboard.study_sessions.view",
    newName: "frontend.dashboard.my_sessions.view",
    description: "access to view my sessions in the dashboard",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Re-create FK with ON UPDATE CASCADE so renaming user_right propagates automatically
    await queryInterface.removeConstraint('role_right_matching', 'role_right_matching_userRightName_fkey');
    await queryInterface.addConstraint('role_right_matching', {
      fields: ['userRightName'],
      type: 'foreign key',
      name: 'role_right_matching_userRightName_fkey',
      references: { table: 'user_right', field: 'name' },
      onUpdate: 'CASCADE',
      onDelete: 'NO ACTION',
    });

    // Add new rights
    await queryInterface.bulkInsert(
      "user_right",
      newRights.map((right) => {
        right["createdAt"] = new Date();
        right["updatedAt"] = new Date();
        return right;
      }),
      {}
    );

    // Rename study_sessions right to my_sessions (cascades to role_right_matching automatically)
    for (const r of renamedRights) {
      await queryInterface.bulkUpdate(
        "user_right",
        { name: r.newName, description: r.description, updatedAt: new Date() },
        { name: r.oldName }
      );
    }
  },

  async down (queryInterface, Sequelize) {
    // Revert renamed rights
    for (const r of renamedRights) {
      await queryInterface.bulkUpdate(
        "user_right",
        { name: r.oldName, updatedAt: new Date() },
        { name: r.newName }
      );
    }

    // Remove new rights
    await queryInterface.bulkDelete("user_right", {
      name: newRights.map((r) => r.name),
    }, {});

    // Restore FK without ON UPDATE CASCADE
    await queryInterface.removeConstraint('role_right_matching', 'role_right_matching_userRightName_fkey');
    await queryInterface.addConstraint('role_right_matching', {
      fields: ['userRightName'],
      type: 'foreign key',
      name: 'role_right_matching_userRightName_fkey',
      references: { table: 'user_right', field: 'name' },
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION',
    });
  }
};
