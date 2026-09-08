'use strict';

const settings = [{
    key: "trigger.queue.pollInterval",
    value: "5",
    type: "integer",
    description: "How often the trigger queue worker looks for pending jobs, in minutes. New jobs still start immediately when an event fires. Requires a server restart.",
    displayName: "Trigger queue poll interval (minutes)",
    displayGroup: "Triggers",
    displaySubsection: "Queue",
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
