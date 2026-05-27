"use strict";

const MAIL_SERVICE_KEY_PREFIX = "system.mailService.";

/**
 * Returns whether a settings payload includes any key under system.mailService.*.
 *
 * @param {Object[]} settings setting entries
 * @param {string} settings.key setting key
 * @param {*} settings.value setting value
 * @returns {boolean}
 */
function payloadTouchesMailService(settings) {
    if (!Array.isArray(settings)) {
        return false;
    }
    for (const setting of settings) {
        if (!setting || typeof setting.key !== "string") {
            continue;
        }
        if (setting.key.startsWith(MAIL_SERVICE_KEY_PREFIX)) {
            return true;
        }
    }
    return false;
}

/**
 * Normalize setting values to string payload format expected by the settings model.
 *
 * @param {*} value setting value
 * @returns {string}
 */
function normalizeSettingValue(value) {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Persist settings through the setting model and report if mail transport must refresh.
 *
 * @param {Object} Setting setting model
 * @param {Object[]} settings setting entries
 * @param {string} settings.key setting key
 * @param {*} settings.value setting value
 * @param {Object} [options] additional options
 * @param {Object} [options.transaction] sequelize transaction
 * @returns {Promise<object>} result with touchesMailService flag
 */
async function saveSettings(Setting, settings, options = {}) {
    const list = Array.isArray(settings) ? settings : [];
    const touchesMailService = payloadTouchesMailService(list);
    for (const setting of list) {
        if (!setting || typeof setting.key !== "string" || setting.key.trim() === "") {
            continue;
        }
        await Setting.set(setting.key, normalizeSettingValue(setting.value), {
            transaction: options.transaction,
        });
    }
    return { touchesMailService };
}

module.exports = {
    payloadTouchesMailService,
    normalizeSettingValue,
    saveSettings,
};
