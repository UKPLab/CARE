'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class ApiKey extends MetaModel {
        static autoTable = true;

        static associate(models) {
            ApiKey.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'owner',
            });
        }

        /**
         * Find all API keys accessible to a user (own + shared with their studies/projects)
         * @param {number} userId
         * @param {Object} options
         * @returns {Promise<Object[]>}
         */
        static async getAccessibleKeys(userId, options = {}) {
            const {Op} = require('sequelize');
            return await this.findAll({
                where: {
                    deleted: false,
                    enabled: true,
                    [Op.or]: [
                        {userId: userId},
                        {shared: true, sharedScope: 'system'},
                    ],
                },
                raw: true,
                ...options,
            });
        }

        /**
         * Resolve the best API key for a given user and provider.
         * Priority: user's own key > shared study/project key > system fallback
         * @param {number} userId
         * @param {string} provider
         * @returns {Promise<Object|null>}
         */
        static async resolveKey(userId, provider) {
            const {Op} = require('sequelize');
            const keys = await this.findAll({
                where: {
                    deleted: false,
                    enabled: true,
                    provider: provider,
                    [Op.or]: [
                        {userId: userId},
                        {shared: true},
                    ],
                },
                order: [
                    [sequelize.literal(`CASE WHEN "userId" = ${parseInt(userId)} THEN 0 ELSE 1 END`), 'ASC'],
                    ['createdAt', 'ASC'],
                ],
                raw: true,
            });
            return keys.length > 0 ? keys[0] : null;
        }
    }

    ApiKey.init({
        userId: DataTypes.INTEGER,
        provider: DataTypes.STRING,
        name: DataTypes.STRING,
        apiEndpoint: DataTypes.STRING,
        encryptedKey: DataTypes.TEXT,
        enabled: DataTypes.BOOLEAN,
        shared: DataTypes.BOOLEAN,
        sharedScope: DataTypes.STRING,
        sharedTargetId: DataTypes.INTEGER,
        usageLimitMonthly: DataTypes.INTEGER,
        lastUsedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'api_key',
        tableName: 'api_key',
    });

    return ApiKey;
};
