'use strict';

const KEY = 'app.locale';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const now = new Date();
        await queryInterface.sequelize.query(
            `UPDATE setting SET "displayName" = :dn, "displayGroup" = :dg, "displaySubsection" = :ds, "updatedAt" = :now WHERE key = :k`,
            {
                replacements: {
                    dn: 'Default UI language',
                    dg: 'Interface',
                    ds: 'Localization',
                    k: KEY,
                    now,
                },
            }
        );
    },

    async down(queryInterface) {
        const now = new Date();
        await queryInterface.sequelize.query(
            `UPDATE setting SET "displayName" = NULL, "displayGroup" = NULL, "displaySubsection" = NULL, "updatedAt" = :now WHERE key = :k`,
            {
                replacements: { k: KEY, now },
            }
        );
    },
};
