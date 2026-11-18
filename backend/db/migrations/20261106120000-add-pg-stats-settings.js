'use strict';

const definitions = [
    ['intervalSeconds', '100', 'integer'],
    ['autoDelete', 'false', 'boolean'],
    ['retentionDays', '30', 'integer'],
];

module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkInsert('setting', definitions.map(([name, value, type]) => ({
            key: `system.pgStats.${name}`,
            // Preserve an existing deployment interval when introducing the admin setting.
            value: name === 'intervalSeconds' && /^\d+$/.test(process.env.PG_STATS_INTERVAL_MS || '')
                && Number(process.env.PG_STATS_INTERVAL_MS) >= 1000 && Number(process.env.PG_STATS_INTERVAL_MS) <= 2147483000
                ? String(Math.ceil(Number(process.env.PG_STATS_INTERVAL_MS) / 1000)) : value,
            type,
            description: `settings.pgStats.${name}.description`,
            displayName: `settings.pgStats.${name}.displayName`,
            displayGroup: 'settings.pgStats.group',
            onlyAdmin: true,
            allowUserOverride: false,
            createdAt: now,
            updatedAt: now,
        })));
    },
    async down(queryInterface) {
        await queryInterface.bulkDelete('setting', { key: definitions.map(([name]) => `system.pgStats.${name}`) });
    },
};
