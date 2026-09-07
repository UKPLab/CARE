'use strict';

const KEY = 'app.locale';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkUpdate(
            'setting',
            {
                displayName: 'Default UI language',
                displayGroup: 'Interface',
                displaySubsection: 'Localization',
                updatedAt: now,
            },
            { key: KEY }
        );
    },

    async down(queryInterface) {
        const now = new Date();
        await queryInterface.bulkUpdate(
            'setting',
            {
                displayName: null,
                displayGroup: null,
                displaySubsection: null,
                updatedAt: now,
            },
            { key: KEY }
        );
    },
};
