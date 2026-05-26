'use strict';

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

  async down() {
    // Intentionally left as no-op because original free-text values were not uniquely preserved.
  },
};
