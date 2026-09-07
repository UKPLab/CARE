'use strict';

const RIGHT = {
    name: "frontend.preferences.disableLanguageSelection",
    description: "disables the ability to change the UI language in preferences",
};

const ROLE_NAME = "guest";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const userRoles = await queryInterface.sequelize.query('SELECT id, name FROM "user_role"', {
            type: queryInterface.sequelize.QueryTypes.SELECT,
        });

        const guestRole = userRoles.find((role) => role.name === ROLE_NAME);
        if (!guestRole) {
            return;
        }

        await queryInterface.bulkInsert(
            "user_right",
            [{
                ...RIGHT,
                createdAt: new Date(),
                updatedAt: new Date(),
            }],
            {}
        );

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
