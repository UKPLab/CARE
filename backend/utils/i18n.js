/**
 * Backend i18n Utility
 *
 * Loads English translations from the shared i18n module directory
 * and provides a translation function for backend logging/fallbacks.
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

function t(key, params = {}) {
    const trans = loadTranslations();
    if (Object.prototype.hasOwnProperty.call(trans, key)) {
        return interpolate(trans[key], params);
    }
    return key;
}

function hasKey(key) {
    const trans = loadTranslations();
    return Object.prototype.hasOwnProperty.call(trans, key);
}

/**
 * English text for dashboard log storage when message is an i18n key.
 *
 * @param {string} message
 * @returns {string}
 */
function resolveLogText(message) {
    if (typeof message !== 'string') {
        return message;
    }
    if (hasKey(message)) {
        return t(message);
    }
    return message;
}

module.exports = { t, hasKey, loadTranslations, resolveLogText };
