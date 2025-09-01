'use strict';

const settings = [{
    key: "statistics.batch.size",
    value: "100",
    type: "number",
    description: "Batch size for buffering statistics events before flushing to DB (requires server restart)"
}];

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
            t['createdAt'] = new Date();
            t['updatedAt'] = new Date();
            return t;
        }), {returning: true});

    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});
    }
};
