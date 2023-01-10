'use strict';

const basicElements = [
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
            basicElements.map(t => {
                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                t['groupId'] = groups.find(g => g.name === t.groupId).id;
                return t;
            }),
            {});
    },

    async down(queryInterface, Sequelize) {
        //delete nav elements first
        await queryInterface.bulkDelete("nav_element", {
            name: basicElements.map(t => t.name)
        }, {});
    }
};
