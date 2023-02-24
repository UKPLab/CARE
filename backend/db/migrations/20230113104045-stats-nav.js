'use strict';

const navElements = [
    {
        name: "User Statistics",
        groupId: "Admin",
        icon: 'bar-chart-steps',
        order: 10,
        admin: true,
        path: "user_stats",
        component: 'UserStatistics'
    }
];

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkInsert("nav_element",
            await Promise.all(navElements.map(async t => {
                const groupId = await queryInterface.rawSelect('nav_group', {
                    where:
                        {name: t.groupId}
                    ,
                }, ['id']);

                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                t['groupId'] = groupId;

                return t;
            }),
            {}));
    },

    async down(queryInterface, Sequelize) {
        //delete nav elements first
        await queryInterface.bulkDelete("nav_element", {
            name: navElements.map(t => t.name)
        }, {});
    }
};
