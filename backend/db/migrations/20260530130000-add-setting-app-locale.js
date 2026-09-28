'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        const existing = await queryInterface.rawSelect(
            'setting',
            { where: { key: 'app.locale' } },
            ['key']
        );
        if (existing) {
            await queryInterface.bulkUpdate(
                'setting',
                { allowUserOverride: true, updatedAt: now },
                { key: 'app.locale' }
            );
            return;
        }

        await queryInterface.bulkInsert('setting', [{
            key: 'app.locale',
            value: 'en',
            type: 'string',
            description: 'Default UI language. Users may override via user_setting.',
            allowUserOverride: true,
            createdAt: now,
            updatedAt: now,
        }]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', { key: 'app.locale' });
    },
};
