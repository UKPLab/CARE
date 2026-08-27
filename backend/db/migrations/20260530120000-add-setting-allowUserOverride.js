'use strict';

/** Keys in `setting` that users may override via `user_setting`. */
const USER_OVERRIDABLE_SETTING_KEYS = [
    'projects.default',
    'tags.tagSet.default',
    'annotator.nlp.activated',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('setting', 'allowUserOverride', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        const now = new Date();
        for (const key of USER_OVERRIDABLE_SETTING_KEYS) {
            await queryInterface.bulkUpdate(
                'setting',
                { allowUserOverride: true, updatedAt: now },
                { key }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('setting', 'allowUserOverride');
    },
};
