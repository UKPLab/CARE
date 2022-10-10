'use strict';

const basicGroups = [
    {'name': "Default",},
    {'name': "Admin", "admin": true}
]

//TODO add icons in objects

const basicElements = [
    {
        name: "Dashboard",
        groupId: basicGroups[0].name,
        default: true,
        order: 1,
        path: "home",
        component: 'Home',
        alias: "[\"/\", \"/index.html\"]"
    },
    {
        name: "Documents",
        groupId: basicGroups[0].name,
        'icon': 'IconFan',
        "order": 10,
        "path": "documents",
        'component': 'Documents'
    },
    {name: "Reviews", groupId: basicGroups[0].name, "path": "reviews", 'component': 'Reviews'},
    {name: "Meta Reviews", groupId: basicGroups[0].name, admin: true, path: "meta_reviews", 'component': 'MetaReviews'},
    {name: "Tags", groupId: basicGroups[0].name, path: "tags", 'component': 'Tags'},
    {name: "Settings", groupId: basicGroups[1].name, admin: true, path: "settings", 'component': 'Settings'}
];

//TODO add icons in objects


module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('nav_group',
            basicGroups.map(t => {
                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                return t;
            }), {returning: true});

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

        // and then delete groups
        await queryInterface.bulkDelete('nav_group', {
            name: basicGroups.map(t => t.name)
        }, {});
    }
};
