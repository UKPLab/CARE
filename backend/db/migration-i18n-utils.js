'use strict';

/**
 * Helpers for Sequelize migrations that store i18n keys in the database.
 * Down migrations resolve English source strings from en locale JSON.
 *
 * @author Andrii Nikitin
 */
const { t, hasKey } = require('../utils/i18n');

/**
 * @param {string} i18nKey
 * @returns {string} English text from ``en`` JSON, or ``i18nKey`` unchanged if the key is missing
 *   (safe fallback so ``down`` migrations do not need a null check).
 */
function resolveEnText(i18nKey) {
  if (typeof i18nKey !== 'string') {
    return i18nKey;
  }
  return t(i18nKey);
}

module.exports = { resolveEnText, t, hasKey };
