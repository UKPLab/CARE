/**
 * Backend i18n Utility
 *
 * Loads English translations from the shared i18n module directory
 * and provides translation helpers for backend English output (logs, socket fallbacks).
 */

const fs = require('fs');
const path = require('path');

let translations = null;

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

function loadTranslations() {
    if (translations !== null) {
        return translations;
    }

    const i18nDir = path.resolve(__dirname, '../../utils/modules/i18n/en');
    const merged = {};

    try {
        if (!fs.existsSync(i18nDir)) {
            translations = {};
            return translations;
        }

        const files = fs.readdirSync(i18nDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(i18nDir, file);
                const namespace = file.replace('.json', '');
                const content = fs.readFileSync(filePath, 'utf-8');
                merged[namespace] = JSON.parse(content);
            }
        }

        translations = flattenObject(merged);
    } catch (_error) {
        translations = {};
    }

    return translations;
}

function interpolate(text, params = {}) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            return String(params[key]);
        }
        return match;
    });
}

/**
 * Checks whether a dot-notation key exists in the English catalog.
 *
 * @param {string} key - e.g. `errors.auth.invalidCredentials`
 * @returns {boolean} `true` when the key is defined in `utils/modules/i18n/en/*.json`
 */
function hasKey(key) {
    const trans = loadTranslations();
    return Object.prototype.hasOwnProperty.call(trans, key);
}

/**
 * Translates a value when it is a known i18n key; otherwise returns it unchanged.
 *
 * @param {string} value - i18n key or plain English string
 * @param {Object} [params] - Optional placeholder values for keys like "Hello {name}"
 * @returns {string|null|undefined}
 */
function translateMaybeKey(value, params = {}) {
    if (value === undefined || value === null) {
        return value;
    }
    if (hasKey(value)) {
        const trans = loadTranslations();
        return interpolate(trans[value], params);
    }
    return value;
}

module.exports = { hasKey, loadTranslations, translateMaybeKey };
