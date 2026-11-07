'use strict';

const navElements = [
  {
    name: 'Assessments',
    icon: 'clipboard-check',
    order: 4,
    admin: false,
    path: 'assessments',
    component: 'Assessments',
  },
];

const userRights = [
  {
    name: 'frontend.dashboard.assessments.view',
    description: 'access to view the assessment management dashboard',
  },
];

// Prototype: admins only until the feature has real backend access control
const roleRights = [
  {
    role: 'admin',
    userRightName: 'frontend.dashboard.assessments.view',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const homeGroupId = await queryInterface.rawSelect(
      'nav_group',
      {
        where: { name: 'Home' },
      },
      ['id']
    );

    if (!homeGroupId) {
      throw new Error("nav_group 'Home' not found; cannot add the Assessments nav element");
    }

    await queryInterface.bulkInsert(
      'nav_element',
      navElements.map((element) => ({
        name: element.name,
        icon: element.icon,
        order: element.order,
        admin: element.admin,
        path: element.path,
        component: element.component,
        groupId: homeGroupId,
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
      roleRights
        .filter((right) => roleNameIdMapping[right.role] !== undefined)
        .map((right) => ({
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
      { path: navElements.map((element) => element.path) },
      {}
    );
  },
};
