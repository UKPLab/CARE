'use strict';

/**
 * Restriction right for the shared guest account: the dashboard home shows a
 * short guest page (notice, starting points, open studies) instead of the
 * personal statistics, since every guest shares the same user.
 * Same pattern as 20260530140000-add-disable-language-selection-right.js.
 */
const RIGHT = {
    name: "frontend.dashboard.home.guestView",
    description: "shows the shared-guest home page instead of personal statistics",
};

const ROLE_NAME = "guest";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
            type: queryInterface.sequelize.QueryTypes.SELECT,
        });

        await queryInterface.bulkInsert(
            "user_right",
            [{
                ...RIGHT,
                createdAt: new Date(),
                updatedAt: new Date(),
            }],
            {}
        );

        const guestRole = userRoles.find((role) => role.name === ROLE_NAME);
        if (!guestRole) {
            return;
        }

        await queryInterface.bulkInsert(
            "role_right_matching",
            [{
                userRoleId: guestRole.id,
                userRightName: RIGHT.name,
                createdAt: new Date(),
                updatedAt: new Date(),
            }],
            {}
        );
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete(
            "role_right_matching",
            { userRightName: RIGHT.name },
            {}
        );

        await queryInterface.bulkDelete(
            "user_right",
            { name: RIGHT.name },
            {}
        );
    },
};
