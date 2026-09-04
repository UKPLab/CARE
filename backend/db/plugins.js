const { DataTypes } = require('sequelize');
const { encrypt, decrypt, hashForUnique } = require('../utils/helper/encryption.js');

/**
 * Merge a new hook function into a model's hooks options object.
 * Handles the case where a hook already exists (single function or array).
 *
 * @param {Object} hooks - The hooks object from model options
 * @param {string} hookName - e.g. 'beforeCreate'
 * @param {Function} fn - The hook function to add
 */
function addHook(hooks, hookName, fn) {
    const existing = hooks[hookName];
    if (!existing) {
        hooks[hookName] = fn;
    } else if (Array.isArray(existing)) {
        existing.unshift(fn); // encryption runs before other hooks
    } else {
        hooks[hookName] = [fn, existing];
    }
}

/**
 * Plugin to add generic field-level encryption to any model that declares encryptedFields.
 *
 * Each entry in encryptedFields can be a plain string or an object:
 *   encryptedFields: ['firstName', { name: 'email', unique: true }]
 *
 * When unique: true, the plugin automatically:
 *   - Adds a {name}Hash column (STRING, unique) to the model attributes
 *   - Writes an HMAC-SHA256 of the plaintext into {name}Hash on every create/update
 *   - The DB migration must still add the {name}Hash column; the model definition is handled here
 *
 * @param {Object} options    - The model options passed to Model.init()
 * @param {Object} attributes - The model attributes passed to Model.init() — mutated to inject hash columns
 */
function addEncryptionHooks(options, attributes = {}) {
    if (process.env.ENCRYPTION_ENABLED !== 'true') return;
    const rawFields = options.encryptedFields;
    if (!rawFields?.length) return;

    const parsed = rawFields.map(f => typeof f === 'string' ? { name: f, unique: false } : { name: f.name, unique: !!f.unique });
    const fieldNames = parsed.map(f => f.name);
    const uniqueFields = new Set(parsed.filter(f => f.unique).map(f => f.name));

    // Auto-inject {name}Hash into model attributes for unique encrypted fields
    for (const name of uniqueFields) {
        const hashField = `${name}Hash`;
        if (!attributes[hashField]) {
            attributes[hashField] = { type: DataTypes.STRING, unique: true };
        }
    }

    if (!options.hooks) options.hooks = {};

    // Hash plaintext then encrypt — must happen in this order
    const encryptField = (instance, name) => {
        const val = instance[name];
        if (val == null) return;
        if (uniqueFields.has(name)) instance[`${name}Hash`] = hashForUnique(val);
        instance[name] = encrypt(val);
    };

    // Encrypt on INSERT
    addHook(options.hooks, 'beforeCreate', (instance) => {
        for (const name of fieldNames) encryptField(instance, name);
    });

    addHook(options.hooks, 'beforeUpsert', (instance) => {
        for (const name of fieldNames) encryptField(instance, name);
    });

    // Encrypt changed fields on UPDATE
    addHook(options.hooks, 'beforeUpdate', (instance) => {
        for (const name of fieldNames) {
            if (instance.changed(name)) encryptField(instance, name);
        }
    });

    // Encrypt on bulk INSERT
    addHook(options.hooks, 'beforeBulkCreate', (opts) => {
        const records = opts.records || opts.instances || [];
        for (const instance of records) {
            for (const name of fieldNames) encryptField(instance, name);
        }
    });

    // Decrypt on every read (single instance or array)
    addHook(options.hooks, 'afterFind', (result) => {
        if (!result) return;
        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            for (const name of fieldNames) {
                const val = row[name];
                if (val != null) row[name] = decrypt(val);
            }
        }
    });
}

/**
 * Plugin to add global change tracking hooks to all models.
 *
 * @param sequelize - The Sequelize instance
 */
function GlobalChangeTrackingPlugin(sequelize) {
    // Register global hooks for all models
    sequelize.addHook('beforeDefine', (attributes, options) => {
        // Inject encryption hooks for models that declare encryptedFields
        addEncryptionHooks(options, attributes);

        // Add hooks to the model
        const globalHooks = {
            afterCreate: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    options.transaction.changes.push(instance);
                }
            },
            afterUpdate: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    options.transaction.changes.push(instance);
                }
            },
            afterUpsert: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    const record = Array.isArray(instance) ? instance[0] : instance;
                    options.transaction.changes.push(record);
                }
            },
            afterDestroy: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    instance.dataValues.deleted = true;
                    options.transaction.changes.push(instance);
                }
            }
        };

        if (!options.hooks)
                options.hooks = {};

        // Merge global hooks with model-specific hooks
        Object.entries(globalHooks).forEach(([hookName, hookFunction]) => {
            const existingHooks = options.hooks?.[hookName];

            // Merge hooks if there are existing hooks
            if (existingHooks) {
                if (Array.isArray(existingHooks)) {
                    options.hooks[hookName].push(hookFunction);
                } else {
                    options.hooks[hookName] = [existingHooks, hookFunction];
                }
            } else {
                // Add only the new global hook
                options.hooks[hookName] = [hookFunction];
            }
        });

    });
}
const logger = require("../utils/logger.js")("TransactionTimeout");
function TimeoutTrackerPlugin(instance) {
    const originalQuery = instance.query;

    instance.query = async function() {
        try {
            return await originalQuery.apply(this, arguments);
        } catch (err) {
            // Check for the specific Postgres error code for idle transaction timeouts
            const pgError = err.parent || err.original;
            if (pgError && pgError.code === '25P03') {
                const stack = new Error("Sequelize Stability Tracer").stack;
                logger.error('CRITICAL: Postgres killed a zombie transaction.');
                logger.error("Trace: "+ stack);
            }
            throw err;
        }
    };
}
module.exports = {
    GlobalChangeTrackingPlugin,
    TimeoutTrackerPlugin,
};