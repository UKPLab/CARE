'use strict';

const settings = [{
    key: "trigger.queue.pollInterval",
    value: "5",
    type: "integer",
    description: "settings.triggerQueue.pollInterval.description",
    displayName: "settings.triggerQueue.pollInterval.displayName",
    displayGroup: "settings.triggerQueue.group",
    displaySubsection: "settings.triggerQueue.queue",
    onlyAdmin: true,
}];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert("setting", settings.map((setting) => {
            setting.createdAt = now;
            setting.updatedAt = now;
            return setting;
        }));
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map((setting) => setting.key),
        });
    },
};
