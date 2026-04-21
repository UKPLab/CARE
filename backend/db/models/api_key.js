'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class LlmCredential extends MetaModel {
        static autoTable = true;

        static associate(models) {
            LlmCredential.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'owner',
            });
            LlmCredential.hasMany(models['llm_credential_share'], {
                foreignKey: 'llmCredentialId',
                as: 'shares',
            });
        }

        /**
         * Find all credentials accessible to a user (owner + direct user share).
         * @param {number} userId
         * @param {Object} options
         * @returns {Promise<Object[]>}
         */
        static async getAccessibleCredentials(userId, options = {}) {
            const {Op} = require('sequelize');
            const now = new Date();
            return await this.findAll({
                where: {
                    deleted: false,
                    enabled: true,
                    [Op.or]: [
                        {userId: userId},
                        {
                            id: {
                                [Op.in]: sequelize.literal(`(
                                    SELECT "llmCredentialId"
                                    FROM "llm_credential_share"
                                    WHERE "deleted" = false
                                      AND "userId" = ${parseInt(userId, 10)}
                                      AND "expiryDate" > '${now.toISOString()}'
                                )`),
                            },
                        },
                    ],
                },
                raw: true,
                ...options,
            });
        }

        /**
         * Resolve a specific credential for a requesting user.
         * Priority: user's own credential > valid user share.
         * @param {number} userId
         * @param {number} llmCredentialId
         * @returns {Promise<Object|null>}
         */
        static async resolveCredential(userId, llmCredentialId) {
            const {Op} = require('sequelize');
            const now = new Date();
            const keys = await this.findAll({
                where: {
                    deleted: false,
                    enabled: true,
                    id: llmCredentialId,
                    [Op.or]: [
                        {userId: userId},
                        {
                            id: {
                                [Op.in]: sequelize.literal(`(
                                    SELECT "llmCredentialId"
                                    FROM "llm_credential_share"
                                    WHERE "deleted" = false
                                      AND "userId" = ${parseInt(userId, 10)}
                                      AND "expiryDate" > '${now.toISOString()}'
                                )`),
                            },
                        },
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

    LlmCredential.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        apiKey: DataTypes.TEXT,
        apiBaseUrl: DataTypes.STRING,
        apiVersion: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        additionalParameters: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'llm_credential',
        tableName: 'llm_credential',
    });

    return LlmCredential;
};
