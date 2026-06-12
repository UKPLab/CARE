const { encrypt, decrypt } = require('../utils/encryption');

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
 * Usage in a model's User.init() options:
 *   encryptedFields: ['firstName', 'lastName', 'email']
 *
 * The plugin automatically injects beforeCreate, beforeUpdate, and afterFind hooks
 * that encrypt/decrypt those fields transparently. No per-model hook code needed.
 *
 * @param {Object} options - The model options passed to Model.init()
 */
function addEncryptionHooks(options) {
    const fields = options.encryptedFields;
    if (!fields || !Array.isArray(fields) || fields.length === 0) return;

    if (!options.hooks) options.hooks = {};

    // Encrypt on INSERT
    addHook(options.hooks, 'beforeCreate', (instance) => {
        for (const field of fields) {
            const val = instance[field];
            if (val !== null && val !== undefined) {
                instance[field] = encrypt(val);
            }
        }
    });

    addHook(options.hooks, 'beforeUpsert', (instance) => {
        for (const field of fields) {
            const val = instance[field];
            if (val !== null && val !== undefined) {
                instance[field] = encrypt(val);
            }
        }
    });

    // Encrypt changed fields on UPDATE
    addHook(options.hooks, 'beforeUpdate', (instance) => {
        for (const field of fields) {
            if (instance.changed(field)) {
                const val = instance[field];
                if (val !== null && val !== undefined) {
                    instance[field] = encrypt(val);
                }
            }
        }
    });

    // Encrypt on bulk INSERT
    addHook(options.hooks, 'beforeBulkCreate', (options) => {
        const records = options.records || options.instances || [];
        for (const instance of records) {
            for (const field of fields) {
                const val = instance[field];
                if (val !== null && val !== undefined) {
                    instance[field] = encrypt(val);
                }
            }
        }
    });

    // Decrypt on every read (single instance or array)
    addHook(options.hooks, 'afterFind', (result) => {
        if (!result) return;
        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            for (const field of fields) {
                const val = row[field];
                if (val !== null && val !== undefined) {
                    row[field] = decrypt(val);
                }
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
        addEncryptionHooks(options);

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