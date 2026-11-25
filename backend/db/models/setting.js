'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

// Short-lived copies of settings read on every REST request (see getCached). Saving any setting
// clears them, so a change made in CARE applies at once.
const cachedSettings = new Map();

module.exports = (sequelize, DataTypes) => {
    class Setting extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Setting.belongsTo(models["wizard_step"], {
                foreignKey: "wizardStepId",
                as: "wizardStep",
            });
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
         * Get a setting value by key, reusing a copy read less than maxAgeMs ago. For settings read
         * on every request (REST token switch, rate limits). Saving a setting through the model
         * clears the copies; only a change made directly in the database waits up to maxAgeMs.
         * @param {string} key setting key
         * @param {number} [maxAgeMs] how long a copy may be reused, 30 seconds by default
         * @returns {Promise<string|null>} the setting value
         */
        static async getCached(key, maxAgeMs = 30 * 1000) {
            const cached = cachedSettings.get(key);
            if (cached && Date.now() - cached.readAt < maxAgeMs) {
                return cached.value;
            }
            const value = await Setting.get(key);
            cachedSettings.set(key, {value, readAt: Date.now()});
            return value;
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
         * Get settings that are shown in the setup wizard, ordered by wizardOrder.
         * @returns {Promise<object[]>}
         */
        static async getWizardSettings() {
            try {
                return await Setting.findAll({
                    where: { showInWizard: true, deleted: false },
                    order: [['wizardOrder', 'ASC']],
                    attributes: [
                        'key',
                        'value',
                        'type',
                        'description',
                        'displayName',
                        'displaySubsection',
                        'requiredInWizard',
                        [sequelize.col('wizardStep.key'), 'wizardStep'],
                    ],
                    include: [{
                        model: sequelize.models["wizard_step"],
                        as: "wizardStep",
                        attributes: [],
                        required: false,
                    }],
                    raw: true,
                });
            } catch (e) {
                console.log(e);
                return [];
            }
        }

        /**
         * Get wizard settings grouped by wizardStep for frontend consumption.
         * Settings without wizardStep are placed in 'general'.
         * @returns {Promise<object>}
         */
        static async getWizardSettingsByStep() {
            try {
                const settings = await Setting.getWizardSettings();
                const byStep = { general: [], mail: [], registration: [], moodle: [] };
                for (const s of settings) {
                    const step = (s.wizardStep && Object.prototype.hasOwnProperty.call(byStep, s.wizardStep))
                        ? s.wizardStep
                        : 'general';
                    byStep[step].push(s);
                }
                return byStep;
            } catch (e) {
                console.log(e);
                return { general: [], mail: [], registration: [], moodle: [] };
            }
        }

        /**
         * Mail service settings only (keys under system.mailService.*).
         * Used for test mail and mail transport helpers without loading all settings.
         * @returns {Promise<object[]>}
         */
        static async getMailServiceSettings() {
            try {
                return await Setting.findAll({
                    where: {
                        deleted: false,
                        key: {[Op.like]: 'system.mailService.%'},
                    },
                    attributes: ['key', 'value'],
                    raw: true,
                });
            } catch (e) {
                console.log(e);
                return [];
            }
        }

        /**
         * Set setting value by key
         * @param {string} key                   setting key
         * @param {string} value                 setting value
         * @param {Object} [options]             additional sequelize options
         * @param {Object} [options.transaction] sequelize transaction
         * @returns {Promise<object>}            
         */
        static async set(key, value, options = {}) {
            try {
                const [instance] =
                    await Setting.upsert({
                        key: key,
                        value: value,
                    }, {
                        conflictFields: ['key'],
                        transaction: options.transaction,
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
        displayName: DataTypes.STRING,
        displayGroup: DataTypes.STRING,
        displaySubsection: DataTypes.STRING,
        onlyAdmin: DataTypes.BOOLEAN,
        allowUserOverride: DataTypes.BOOLEAN,
        showInWizard: DataTypes.BOOLEAN,
        wizardOrder: DataTypes.INTEGER,
        requiredInWizard: DataTypes.BOOLEAN,
        wizardStepId: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE

    }, {
        sequelize,
        modelName: 'setting',
        tableName: 'setting',
        hooks: {
            afterUpsert: () => cachedSettings.clear(),
            afterCreate: () => cachedSettings.clear(),
            afterUpdate: () => cachedSettings.clear(),
            afterBulkUpdate: () => cachedSettings.clear(),
            afterDestroy: () => cachedSettings.clear(),
        },
    });

    Setting.removeAttribute('id');

    return Setting;
};