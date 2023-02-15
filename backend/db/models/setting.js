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
                return await Setting.create({
                    key: key,
                    value: value,
                    type: 'string',
                    description: ''
                }).then((msg) => {
                    return msg;
                }).catch(async (err) => {
                    return (await Setting.update({value: value}, {
                        where: {key: key},
                        returning: true,
                        plain: true
                    }))[1].dataValues;
                });
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

    }, {
        sequelize,
        modelName: 'setting',
        tableName: 'setting'
    });

    Setting.removeAttribute('id');

    return Setting;
};