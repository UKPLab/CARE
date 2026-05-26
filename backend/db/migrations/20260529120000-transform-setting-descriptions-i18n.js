'use strict';

const { resolveEnText } = require('../migration-i18n-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT "key", "description" FROM "setting" WHERE "description" IS NOT NULL AND TRIM("description") <> ''`
    );

    for (const row of rows) {
      const desc = row.description;
      if (typeof desc === 'string' && desc.startsWith('settings.descriptions.')) {
        continue;
      }
      const i18nKey = `settings.descriptions.${row.key.replace(/\./g, '_')}`;
      await queryInterface.bulkUpdate(
        'setting',
        { description: i18nKey, updatedAt: new Date() },
        { key: row.key },
        {}
      );
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT "key", "description" FROM "setting" WHERE "description" LIKE 'settings.descriptions.%'`
    );

    for (const row of rows) {
      const english = resolveEnText(row.description);
      if (!english) {
        continue;
      }
      await queryInterface.bulkUpdate(
        'setting',
        { description: english, updatedAt: new Date() },
        { key: row.key },
        {}
      );
    }
  },
};
