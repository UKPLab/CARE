'use strict';

const TranslatableError = require('../utils/TranslatableError');
const PREFIX = 'system.pgStats.';
const KEYS = ['intervalSeconds', 'autoDelete', 'retentionDays'].map(key => PREFIX + key);

function validInteger(value, max) {
    return /^\d+$/.test(String(value).trim()) && Number(value) >= 1 && Number(value) <= max;
}

/**
 * Validate PostgreSQL statistics settings, ignoring unrelated keys.
 *
 * @param {Array<{key: string, value: string}>} settings - Settings to validate
 * @returns {void}
 * @throws {TranslatableError} If a statistics setting has an invalid value
 */
function validateSettings(settings) {
    for (const { key, value } of settings.filter(Boolean)) {
        if (!KEYS.includes(key)) continue;
        const valid = key === PREFIX + 'autoDelete'
            ? ['true', 'false'].includes(String(value).trim())
            : validInteger(value, key === PREFIX + 'intervalSeconds' ? 2147483 : 36500);
        if (!valid) throw new TranslatableError('settings.pgStats.invalidValue');
    }
}

/**
 * Load and validate saved statistics settings, applying defaults for missing keys.
 *
 * @param {import('sequelize').Sequelize} sequelize - Connection exposing the setting model
 * @param {number} fallbackIntervalMs - Collection interval when no saved interval exists
 * @returns {Promise<{intervalMs: number, autoDelete: boolean, retentionDays: number}>} Effective configuration
 * @throws {TranslatableError} If a saved statistics setting has an invalid value
 */
async function loadSettings(sequelize, fallbackIntervalMs) {
    const rows = await sequelize.models.setting.findAll({
        where: { key: KEYS, deleted: false }, attributes: ['key', 'value'], raw: true,
    });
    validateSettings(rows);
    const values = Object.fromEntries(rows.map(row => [row.key.slice(PREFIX.length), row.value]));
    return {
        intervalMs: values.intervalSeconds == null ? fallbackIntervalMs : Number(values.intervalSeconds) * 1000,
        autoDelete: values.autoDelete === 'true',
        retentionDays: values.retentionDays == null ? 30 : Number(values.retentionDays),
    };
}

module.exports = { KEYS, validateSettings, loadSettings };
