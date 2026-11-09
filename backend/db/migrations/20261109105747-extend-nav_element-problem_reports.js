'use strict';

/**
 * Add the admin-only Problem Reports page to the Settings nav group,
 * where administrators read reports submitted from the topbar Report button.
 */

const navElements = [
    {
        name: 'Problem Reports',
        groupId: 'Settings',
        icon: 'bug',
        order: 5,
        admin: true,
        path: 'problem_reports',
        component: 'ProblemReports',
    },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.bulkInsert(
            'nav_element',
            await Promise.all(
                navElements.map(async (element) => {
                    const groupId = await queryInterface.rawSelect(
                        'nav_group',
                        {where: {name: element.groupId}},
                        ['id']
                    );

                    return {
                        ...element,
                        groupId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                })
            ),
            {}
        );
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete(
            'nav_element',
            {name: navElements.map((element) => element.name)},
            {}
        );
    },
};
