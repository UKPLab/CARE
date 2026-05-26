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
 * @returns {string|null} English text, or `null` if the key is missing from `en` JSON.
 *   Callers that skip updates on `null` leave i18n keys in the DB; the frontend then
 *   typically shows that raw key string (e.g. `translateMaybeKey` passes it through when
 *   there is no translation).
 */
function resolveEnText(i18nKey) {
  if (typeof i18nKey !== 'string' || !hasKey(i18nKey, 'en')) {
    return null;
  }
  return t(i18nKey, {}, 'en');
}

module.exports = { resolveEnText, t, hasKey };
