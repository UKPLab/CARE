'use strict';

const navElements = [
    {
        name: 'API Tokens',
        groupId: 'Home',
        icon: 'key',
        order: 4,
        admin: false,
        path: 'api_tokens',
        component: 'ApiTokens',
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
