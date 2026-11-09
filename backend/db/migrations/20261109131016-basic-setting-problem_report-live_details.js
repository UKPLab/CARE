'use strict';
const KEY = 'problemReport.details.updateIntervalMs';
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('setting', [{
            key: KEY,
            displayName: 'settings.problemReport.detailsUpdateInterval.displayName',
            description: 'settings.problemReport.detailsUpdateInterval.description',
            value: '5000',
            type: 'integer',
            displayGroup: 'settings.problemReport.group',
            displaySubsection: 'settings.problemReport.diagnostics',
            onlyAdmin: false,
            createdAt: now,
            updatedAt: now,
        }]);
    },
    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', {key: KEY});
    },
};
