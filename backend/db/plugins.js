/**
 * Plugin to add global change tracking hooks to all models.
 *
 * @param sequelize - The Sequelize instance
 */
function GlobalChangeTrackingPlugin(sequelize) {
    // Register global hooks for all models
    sequelize.addHook('beforeDefine', (attributes, options) => {

        // Add hooks to the model
        const globalHooks = {
            afterCreate: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    instance._broadcastOp = "create";
                    options.transaction.changes.push(instance);
                }
            },
            afterUpdate: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    instance._broadcastOp = instance.deleted ? "delete" : "update";
                    options.transaction.changes.push(instance);
                }
            },
            afterUpsert: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    const record = Array.isArray(instance) ? instance[0] : instance;
                    record._broadcastOp = record.deleted ? "delete" : "update";
                    options.transaction.changes.push(record);
                }
            },
            afterDestroy: (instance, options) => {
                if (options.transaction) {
                    options.transaction.changes = options.transaction.changes || [];
                    instance.dataValues.deleted = true;
                    instance._broadcastOp = "delete";
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