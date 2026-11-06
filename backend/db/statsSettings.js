'use strict';

const TranslatableError = require('../utils/TranslatableError');
const PREFIX = 'system.pgStats.';
const KEYS = ['intervalSeconds', 'autoDelete', 'retentionDays'].map(key => PREFIX + key);

function validInteger(value, max) {
    return /^\d+$/.test(String(value).trim()) && Number(value) >= 1 && Number(value) <= max;
}

function validateSettings(settings) {
    for (const { key, value } of settings.filter(Boolean)) {
        if (!KEYS.includes(key)) continue;
        const valid = key === PREFIX + 'autoDelete'
            ? ['true', 'false'].includes(String(value).trim())
            : validInteger(value, key === PREFIX + 'intervalSeconds' ? 2147483 : 36500);
        if (!valid) throw new TranslatableError('settings.pgStats.invalidValue');
    }
}

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
