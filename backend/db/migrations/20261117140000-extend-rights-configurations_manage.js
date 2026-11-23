'use strict';

/**
 * Right for creating, editing, and deleting own configurations (assessment rubrics and criteria,
 * validation schemas, dialogue plans) through the REST API. Only the REST routes check it. Granted to
 * admin only, matching the dashboard, where creating configurations is admin-only.
 */
const RIGHT = 'frontend.dashboard.configurations.manage';
const ROLES = ['admin'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('user_right', [{
            name: RIGHT,
            description: 'create, edit and delete own configurations through the REST API',
            createdAt: now,
            updatedAt: now,
        }]);
        const roles = await queryInterface.sequelize.query(
            'SELECT id, name FROM "user_role" WHERE name IN (:names)',
            {replacements: {names: ROLES}, type: queryInterface.sequelize.QueryTypes.SELECT}
        );
        if (roles.length > 0) {
            await queryInterface.bulkInsert('role_right_matching', roles.map((role) => ({
                userRoleId: role.id,
                userRightName: RIGHT,
                createdAt: now,
                updatedAt: now,
            })));
        }
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('role_right_matching', {userRightName: RIGHT});
        await queryInterface.bulkDelete('user_right', {name: RIGHT});
    },
};
