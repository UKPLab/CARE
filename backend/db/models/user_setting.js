'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class UserSetting extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
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
         * @returns {Promise<string>} value
         */
        static async set(key, value, userId) {
            try {
                const dbObj = {
                    userId: userId,
                    key: key,
                    value: value
                };

                return await UserSetting.create(dbObj).then((msg) => {
                    return msg;
                }).catch(async (err) => {
                    return await UserSetting.update({value: value}, {where: {[Op.and]: [{userId: userId}, {key: key}]}});
                });
            } catch (e) {
                console.log(e);
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
        tableName: 'user_setting'
    });

    // UserSetting.removeAttribute('id');

    return UserSetting;
};