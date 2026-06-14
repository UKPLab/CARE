'use strict';

const navElements = [
  {
    name: 'AIHooks',
    icon: 'link-45deg',
    order: 4,
    admin: false,
    path: 'ai_hooks',
    component: 'AIHooks',
  },
];

const userRights = [
  {
    name: 'frontend.dashboard.ai_hooks.view',
    description: 'access to view AI hooks in the dashboard',
  },
];

const roleRights = [
  {
    role: 'user',
    userRightName: 'frontend.dashboard.ai_hooks.view',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const aiGroupId = await queryInterface.rawSelect(
      'nav_group',
      {
        where: { name: 'AI' },
      },
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
        groupId: aiGroupId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );

    await queryInterface.bulkInsert(
      'user_right',
      userRights.map((right) => ({
        ...right,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );

    const userRoles = await queryInterface.sequelize.query(
      'SELECT id, name FROM "user_role"',
      {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'role_right_matching',
      { userRightName: roleRights.map((right) => right.userRightName) },
      {}
    );

    await queryInterface.bulkDelete(
      'user_right',
      { name: userRights.map((right) => right.name) },
      {}
    );

    await queryInterface.bulkDelete(
      'nav_element',
      { name: navElements.map((element) => element.name) },
      {}
    );
  },
};
