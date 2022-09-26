'use strict';

const basicTagGroups = [
    ["Peer Review", "A standard tagset for peer review process"]
]

const basicTags = [
    [basicTagGroups[0][0], "Highlight", "warning"],
    [basicTagGroups[0][0], "Strength", "success"],
    [basicTagGroups[0][0], "Weakness", "danger"],
    [basicTagGroups[0][0], "Other", "info"],
];

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('tag_set',
            basicTagGroups.map(t => {
                return {
                    name: t[0],
                    description: t[1],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            }), {returning: true});

        await queryInterface.bulkInsert("tag",
            basicTags.map(t => {
                return {
                    name: t[1],
                    description: t[1],
                    colorCode: t[2],
                    setId: groups.find(g => g.name === t[0]).id,
                    updatedAt: new Date(),
                    createdAt: new Date(),
                    deleted: false
                };
            }),
            {});
    },

    async down(queryInterface, Sequelize) {
        //delete tags first
        await queryInterface.bulkDelete("tag", {
            name: basicTags.map(t => t[0])
        }, {});

        // and then delete groups
        await queryInterface.bulkDelete('tag_set', {
            name: basicTagGroups.map(t => t[0])
        }, {});

    }
};
