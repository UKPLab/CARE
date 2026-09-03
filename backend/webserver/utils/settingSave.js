"use strict";

const { assertStableEmailTemplateContent } = require("../../utils/helper/templateResolver");

const MAIL_SERVICE_KEY_PREFIX = "system.mailService.";
const PRESERVE_WHITESPACE_SETTING_TYPES = new Set(["edits", "text"]);

/**
 * Returns whether a setting value should be trimmed before saving.
 *
 * @param {Object} setting setting entry
 * @returns {boolean}
 */
function shouldTrimSetting(setting) {
    return !PRESERVE_WHITESPACE_SETTING_TYPES.has(setting?.type);
}

/**
 * Reject email.template.* settings that point at a missing or incomplete template.
 *
 * @param {Object} models
 * @param {Object[]} settings
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function validateEmailTemplateSettings(models, settings, options = {}) {
    if (!Array.isArray(settings)) {
        return;
    }

    for (const setting of settings) {
        if (!setting || typeof setting.key !== "string" || !setting.key.startsWith("email.template.")) {
            continue;
        }

        const rawValue = setting.value === null || setting.value === undefined ? "" : String(setting.value).trim();
        if (rawValue === "" || rawValue === "0") {
            continue;
        }

        const templateId = parseInt(rawValue, 10);
        if (isNaN(templateId) || templateId <= 0) {
            continue;
        }

        await assertStableEmailTemplateContent(templateId, models, {
            ...options,
            action: "assigning",
        });
    }
}

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
 * @param {Object} [setting] setting entry
 * @returns {string}
 */
function normalizeSettingValue(value, setting = {}) {
    let normalized;
    if (value === null || value === undefined) {
        normalized = "";
    } else if (typeof value === "object") {
        // NOTE: Coerce object/array payloads to JSON; persisted settings are always strings.
        normalized = JSON.stringify(value);
    } else {
        normalized = String(value);
    }
    return shouldTrimSetting(setting) ? normalized.trim() : normalized;
}

/**
 * Load persisted setting types for payload entries that do not include type metadata.
 *
 * @param {Object} Setting setting model
 * @param {Object[]} settings setting entries
 * @param {Object} [options] additional options
 * @returns {Promise<Map<string, string>>}
 */
async function getSettingTypeByKey(Setting, settings, options = {}) {
    if (typeof Setting.findAll !== "function") {
        return new Map();
    }

    const keys = [...new Set(settings
        .filter((setting) => setting && typeof setting.key === "string" && !setting.type)
        .map((setting) => setting.key))];
    if (!keys.length) {
        return new Map();
    }

    const rows = await Setting.findAll({
        where: { key: keys },
        attributes: ["key", "type"],
        raw: true,
        transaction: options.transaction,
    });
    return new Map(rows.map((row) => [row.key, row.type]));
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
 * @param {Object} [options.models] full models object for email template validation
 * @returns {Promise<object>} result with touchesMailService flag
 */
async function saveSettings(Setting, settings, options = {}) {
    const list = Array.isArray(settings) ? settings : [];
    if (options.models) {
        await validateEmailTemplateSettings(options.models, list, options);
    }
    const touchesMailService = payloadTouchesMailService(list);
    const settingTypeByKey = await getSettingTypeByKey(Setting, list, options);
    for (const setting of list) {
        if (!setting || typeof setting.key !== "string" || setting.key.trim() === "") {
            continue;
        }
        const settingWithType = setting.type ? setting : {
            ...setting,
            type: settingTypeByKey.get(setting.key),
        };
        await Setting.set(setting.key, normalizeSettingValue(setting.value, settingWithType), {
            transaction: options.transaction,
        });
    }
    return { touchesMailService };
}

module.exports = {
    getSettingTypeByKey,
    payloadTouchesMailService,
    normalizeSettingValue,
    saveSettings,
    shouldTrimSetting,
};
