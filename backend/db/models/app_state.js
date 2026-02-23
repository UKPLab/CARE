'use strict';

/**
 * AppState model — key-value store for internal runtime state (e.g. wizard progress).
 * Not user-configurable; separate from the setting table.
 *
 */
module.exports = (sequelize, DataTypes) => {
    const { Model } = require('sequelize');

    class AppState extends Model {
        static associate(models) {
            // no associations
        }

        /**
         * Get value by key
         * @param {string} key
         * @returns {Promise<string|null>}
         */
        static async get(key) {
            try {
                const row = await AppState.findOne({ where: { key }, raw: true });
                return row ? row.value : null;
            } catch (e) {
                console.log(e);
                return null;
            }
        }

        /**
         * Set value by key (upsert)
         * @param {string} key
         * @param {string} value
         * @param {object} options 
         * @returns {Promise<object|null>}
         */
        static async set(key, value, options = {}) {
            try {
                const [instance] = await AppState.upsert(
                    { key, value },
                    { conflictFields: ['key'], ...options }
                );
                return instance?.dataValues ?? null;
            } catch (e) {
                console.log(e);
                return null;
            }
        }
    }

    AppState.init(
        {
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            value: {
                type: DataTypes.TEXT,
            },
        },
        {
            sequelize,
            modelName: 'app_state',
            tableName: 'app_state',
        }
    );

    AppState.removeAttribute('id');

    return AppState;
};
