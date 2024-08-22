'use strict';

const settings = [
    {
        key: "statistics.tracking.enabled",
        value: "false",
        type: "boolean",
        description: "Enable or disable behavior tracking"
    },
    {
        key: "statistics.tracking.mouseDebounceTime",
        value: "500",
        type: "number",
        description: "Debounce time in milliseconds for reporting mouse move events"
    }
]

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
            t["createdAt"] = new Date();
            t["updatedAt"] = new Date();
            return t;
        }), {returning: true});
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});

    }
};
