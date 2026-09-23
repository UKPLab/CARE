'use strict';
const MetaModel = require("../MetaModel.js");
const {Op, UniqueConstraintError} = require("sequelize");
const TranslatableError = require("../../utils/TranslatableError");

module.exports = (sequelize, DataTypes) => {
    class UserSetting extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            UserSetting.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }

        /**
         * Reject user_setting rows that would override a system setting without allowUserOverride.
         * Admin bulk updates pass { bypassSystemSettingCheck: true } in Sequelize options.
         *
         * @param {string} key
         * @param {Object} [options]
         * @returns {Promise<void>}
         */
        static async assertKeyAllowedForUserSetting(key, options = {}) {
            if (options.bypassSystemSettingCheck) {
                return;
            }

            const Setting = sequelize.models["setting"];
            if (!Setting) {
                return;
            }

            const systemSetting = await Setting.getByKey("key", key, {
                attributes: ["key", "allowUserOverride"],
            });

            if (!systemSetting || systemSetting.allowUserOverride) {
                return;
            }

            throw new TranslatableError("errors.settings.cannotOverrideSystemSetting", { key });
        }

        /**
         * Get a setting by key and user id
         * @param {string} key
         * @param {number} userId
         * @returns {Promise<string|null>} value
         */
        static async get(key, userId) {
            try {
                let setting = await UserSetting.findOne({where: {key: key, userId: userId, deleted: false}, raw: true});
                if (setting) {
                    return setting.value;
                }
                return null;
            } catch (e) {
                console.log(e);
            }
        }

        /**
         * Set a setting by key and user id
         * @param {string} key
         * @param {string} value
         * @param {number} userId
         * @param {Object} [options] passed to create/update (e.g. bypassSystemSettingCheck for admin)
         * @returns {Promise<string>} value
         */
        static async set(key, value, userId, options = {}) {
            const existing = await UserSetting.findOne({
                where: {userId, key, deleted: false},
                raw: true,
            });

            if (existing) {
                return await UserSetting.update({value}, {
                    where: {[Op.and]: [{userId}, {key}]},
                    ...options,
                    individualHooks: true,
                });
            }

            try {
                return await UserSetting.create({userId, key, value}, options);
            } catch (err) {
                // Two concurrent set() calls for the same (userId, key) can both pass the
                // findOne() check above; the losing create() then collides on the
                // (key, userId) primary key. Fall back to update() instead of throwing.
                if (err instanceof UniqueConstraintError) {
                    return await UserSetting.update({value}, {
                        where: {[Op.and]: [{userId}, {key}]},
                        ...options,
                        individualHooks: true,
                    });
                }
                throw err;
            }
        }
    }

    UserSetting.init({
        key: DataTypes.STRING,
        value: DataTypes.STRING,
        userId: DataTypes.INTEGER,

    }, {
        sequelize,
        modelName: 'user_setting',
        tableName: 'user_setting',
        hooks: {
            beforeCreate: async (instance, options) => {
                await UserSetting.assertKeyAllowedForUserSetting(instance.key, options);
            },
            beforeUpdate: async (instance, options) => {
                await UserSetting.assertKeyAllowedForUserSetting(instance.key, options);
            },
        },
    });

    UserSetting.removeAttribute('id');

    return UserSetting;
};