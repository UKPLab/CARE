'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class Setting extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }

        /**
         * Get all settings and overwrite to be sure no admin settings are returned to user
         * @param {boolean} includeAdmin include admin settings
         * @returns {Promise<object[]>} setting objects
         */
        static async getAll(includeAdmin = false) {
            try {
                if (includeAdmin) {
                    return await super.getAll();
                } else {
                    return (await super.getAll()).filter((item) => item.onlyAdmin !== true)
                }
            } catch (e) {
                console.log(e);
            }
        }


        /**
         * Get setting value by key
         * @param {string} key setting key
         * @returns {Promise<object|null>} setting object
         */
        static async get(key) {
            try {
                let setting = await Setting.findOne({where: {key: key}, raw: true});
                if (setting) {
                    return setting.value;
                }
                return null;
            } catch (e) {
                console.log(e);
            }
        }

        /**
         * Set setting value by key
         * @param {string} key setting key
         * @param {string} value setting value
         * @returns {Promise<object|null>} setting object
         */
        static async set(key, value) {
            try {
                const [instance, created] =
                    await Setting.upsert({
                        key: key,
                        value: value,
                    }, {
                        conflictFields: ['key']
                    });
                return instance['dataValues'];
            } catch (e) {
                console.log(e);
            }
        }

    }


    Setting.init({
        key: DataTypes.STRING,
        value: DataTypes.TEXT,
        type: DataTypes.STRING,
        description: DataTypes.STRING,
        onlyAdmin: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE

    }, {
        sequelize,
        modelName: 'setting',
        tableName: 'setting'
    });

    Setting.removeAttribute('id');

    return Setting;
};