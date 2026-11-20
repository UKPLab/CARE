'use strict';

const VIEW_RIGHT = 'frontend.dashboard.api_tokens.view';
const NON_GUEST_ROLES = ['admin', 'user', 'teacher', 'mentor', 'student'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('user_right', [{
            name: VIEW_RIGHT,
            description: 'access to view API tokens in the dashboard',
            createdAt: now,
            updatedAt: now,
        }]);

        const userRoles = await queryInterface.sequelize.query(
            'SELECT id, name FROM "user_role"',
            {type: queryInterface.sequelize.QueryTypes.SELECT}
        );
        const roleNameIdMapping = userRoles.reduce((acc, role) => {
            acc[role.name] = role.id;
            return acc;
        }, {});

        await queryInterface.bulkInsert(
            'role_right_matching',
            NON_GUEST_ROLES
                .filter((role) => roleNameIdMapping[role])
                .map((role) => ({
                    userRoleId: roleNameIdMapping[role],
                    userRightName: VIEW_RIGHT,
                    createdAt: now,
                    updatedAt: now,
                })),
            {}
        );
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('role_right_matching', {userRightName: VIEW_RIGHT});
        await queryInterface.bulkDelete('user_right', {name: VIEW_RIGHT});
    },
};
