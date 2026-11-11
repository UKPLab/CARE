'use strict';

/**
 * The 2022 copyright seed already ran. Replace that default only.
 * A notice an admin already changed is left alone, and rolling back
 * does not overwrite a notice changed after this migration.
 */
const KEY = 'app.config.copyright';
const PREVIOUS = 'Copyright © 2022-2024 Team Care UKP Lab (TU Darmstadt)';
const NEXT = 'Copyright © 2022-2026 CARE';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.bulkUpdate(
            'setting',
            { value: NEXT, updatedAt: now },
            { key: KEY, value: PREVIOUS }
        );
    },

    async down(queryInterface) {
        const now = new Date();
        await queryInterface.bulkUpdate(
            'setting',
            { value: PREVIOUS, updatedAt: now },
            { key: KEY, value: NEXT }
        );
    },
};
