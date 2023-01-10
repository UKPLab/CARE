'use strict';

const basicGroups = [
    {'name': "Default",},
    {'name': "Admin", "admin": true}
]

const navElements = [
    {
        name: "NLP Skills",
        groupId: "Admin",
        icon: 'cpu',
        order: 10,
        admin: true,
        path: "nlp_skills",
        component: 'NlpSkills'
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
