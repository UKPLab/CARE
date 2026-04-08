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

        static get encryptionKey() {
            const key = process.env.ENCRYPTION_KEY;
            if (!key) {
                throw new Error('ENCRYPTION_KEY env var is required for encrypted settings');
            }
            return key;
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
                    if (setting.type === 'encrypted' && setting.value) {
                        const [[result]] = await sequelize.query(
                            `SELECT pgp_sym_decrypt(decode($1, 'base64'), $2) AS val`,
                            {bind: [setting.value, Setting.encryptionKey]}
                        );
                        return result.val;
                    }
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
                let finalValue = value;
                if (value) {
                    const existing = await Setting.findOne({where: {key: key}, attributes: ['type'], raw: true});
                    if (existing && existing.type === 'encrypted') {
                        const [[result]] = await sequelize.query(
                            `SELECT encode(pgp_sym_encrypt($1, $2), 'base64') AS val`,
                            {bind: [value, Setting.encryptionKey]}
                        );
                        finalValue = result.val;
                    }
                }
                const [instance, created] =
                    await Setting.upsert({
                        key: key,
                        value: finalValue,
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