'use strict';

const basicGroups = [
    {'name': "Default",},
    {'name': "Admin", "admin": true}
]

const basicElements = [
    {
        name: "Home",
        groupId: basicGroups[0].name,
        order: 1,
        icon: 'HomeIcon',
        path: "home",
        component: 'Home'
    },
    {
        name: "Documents",
        groupId: basicGroups[0].name,
        'icon': 'IconEarmarkText',
        "order": 10,
        "path": "documents",
        'component': 'Documents'
    },
    {
        name: "Reviews",
        groupId: basicGroups[0].name,
        icon: 'ReviewIcon',
        order: 10,
        "path": "reviews",
        'component': 'Reviews'
    },
    {
        name: "Meta Reviews",
        groupId: basicGroups[0].name,
        icon: 'MultipleDocumentIcon',
        order: 10,
        admin: true,
        path: "meta_reviews",
        'component': 'MetaReviews'
    },
    {name: "Tags", groupId: basicGroups[0].name, icon: 'TagIcon', path: "tags", order: 10, 'component': 'Tags'},
    {
        name: "Settings",
        groupId: basicGroups[1].name,
        icon: 'SettingsIcon',
        order: 10,
        admin: true,
        path: "settings",
        'component': 'Settings'
    }
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
