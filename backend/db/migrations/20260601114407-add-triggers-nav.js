'use strict';

const navGroup = {
  name: 'Triggers',
  icon: 'lightning-charge',
  order: 6,
};

const navElements = [
  {
    name: 'Triggers',
    icon: 'lightning',
    order: 1,
    admin: true,
    path: 'triggers',
    component: 'Triggers',
  },
  {
    name: 'Trigger Logs',
    icon: 'list-ul',
    order: 2,
    admin: true,
    path: 'trigger_logs',
    component: 'TriggerLogs',
  },
];

const userRights = [
  {
    name: 'frontend.dashboard.triggers.view',
    description: 'access to manage automatic triggers in the dashboard',
  },
  {
    name: 'frontend.dashboard.trigger_logs.view',
    description: 'access to view trigger execution logs in the dashboard',
  },
];

const roleRights = [
  { role: 'admin', userRightName: 'frontend.dashboard.triggers.view' },
  { role: 'admin', userRightName: 'frontend.dashboard.trigger_logs.view' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert('nav_group', [{
      name: navGroup.name,
      icon: navGroup.icon,
      order: navGroup.order,
      admin: true,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }]);

    const groupId = await queryInterface.rawSelect(
      'nav_group',
      { where: { name: navGroup.name } },
      ['id']
    );

    await queryInterface.bulkInsert(
      'nav_element',
      navElements.map((element) => ({
        name: element.name,
        icon: element.icon,
        order: element.order,
        admin: element.admin,
        path: element.path,
        component: element.component,
        groupId,
        createdAt: now,
        updatedAt: now,
      })),
      {}
    );

    await queryInterface.bulkInsert(
      'user_right',
      userRights.map((right) => ({
        ...right,
        createdAt: now,
        updatedAt: now,
      })),
      {}
    );

    const userRoles = await queryInterface.sequelize.query(
      'SELECT id, name FROM "user_role"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const roleNameIdMapping = userRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});

    await queryInterface.bulkInsert(
      'role_right_matching',
      roleRights.map((right) => ({
        userRoleId: roleNameIdMapping[right.role],
        userRightName: right.userRightName,
        createdAt: now,
        updatedAt: now,
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'role_right_matching',
      { userRightName: roleRights.map((r) => r.userRightName) },
      {}
    );

    await queryInterface.bulkDelete(
      'user_right',
      { name: userRights.map((r) => r.name) },
      {}
    );

    await queryInterface.bulkDelete(
      'nav_element',
      { name: navElements.map((e) => e.name) },
      {}
    );

    await queryInterface.bulkDelete(
      'nav_group',
      { name: navGroup.name },
      {}
    );
  },
};
