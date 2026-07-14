/**
 * Shared i18n module
 *
 * Single source of truth for translations used by both frontend and backend.
 *
 * Frontend (via Vite alias `@i18n`):
 *   import i18nBundles from '@i18n/i18n-bundles.js';
 *   // pass as `messages` to vue-i18n createI18n()
 *
 * Backend (CommonJS):
 *   const { t, hasKey, messages } = require('../../utils/modules/i18n');
 */

const en = require('./en');
const de = require('./de');

const messages = { en, de };

// ── helpers (used by backend; frontend uses vue-i18n instead) ──

function flattenObject(obj, prefix = '') {
    const result = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey));
        } else {
            result[newKey] = value;
        }
    }
    return result;
}

const flatCache = {};
function getFlat(locale) {
    if (!flatCache[locale]) {
        flatCache[locale] = flattenObject(messages[locale] || messages.en);
    }
    return flatCache[locale];
}

function interpolate(text, params) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{(\w+)\}/g, (match, k) =>
        Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : match
    );
}

/**
 * Translate a dot-notation key with optional interpolation.
 * @param {string} key   e.g. 'errors.auth.invalidCredentials'
 * @param {Object} params  e.g. { skill: 'summarization' }
 * @param {string} locale  defaults to 'en'
 * @returns {string}
 */
function t(key, params = {}, locale = 'en') {
    const flat = getFlat(locale);
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
        return interpolate(flat[key], params);
    }
    return key;
}

/**
 * Check whether a translation key exists.
 */
function hasKey(key, locale = 'en') {
    return Object.prototype.hasOwnProperty.call(getFlat(locale), key);
}

module.exports = { messages, t, hasKey };
