'use strict';

/**
 * Sequelize model for per-user LLM provider credentials and orchestration state.
 * Soft-delete/disable cascades to linked models via afterUpdate (same pattern as study/document).
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiCredential extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiCredential.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiCredential.hasMany(models["ai_model"], { foreignKey: "aiCredentialId", as: "models" });
        }

        /**
         * Loads an enabled, non-deleted credential owned by the given user, or throws.
         * Used by AI service calls that need the API key outside the autoTable path.
         *
         * @param {number} id Target `ai_credential` primary key.
         * @param {number} userId Caller's user id (ownership check).
         * @returns {Promise<Object>} The credential row.
         * @throws {Error} If missing, deleted, not owned by the caller, or disabled.
         */
        static async getOwnedById(id, userId) {
            const credential = await AiCredential.getById(id, {
                attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
            });
            if (!credential || credential.deleted) {
                throw new Error("Credential not found");
            }
            if (!userId || credential.userId !== userId) {
                throw new Error("You are not allowed to access this credential");
            }
            if (!credential.enabled) {
                throw new Error("Credential is disabled");
            }
            return credential;
        }

        /**
         * Soft-delete linked models (and their shares / budgets / hook links).
         * Uses individualHooks so GlobalChangeTrackingPlugin fills transaction.changes.
         *
         * @param {Object} credential Soft-deleted credential instance.
         * @param {Object} options Sequelize hook options (transaction + context).
         */
        static async cascadeSoftDelete(credential, options = {}) {
            const {Op} = require("sequelize");
            const transaction = options.transaction;
            const db = sequelize.models;

            const models = await db.ai_model.findAll({
                where: {aiCredentialId: credential.id, deleted: false},
                attributes: ["id"],
                raw: true,
                transaction,
            });
            const modelIds = models.map((m) => m.id);
            if (modelIds.length === 0) {
                return;
            }

            await db.ai_model.update(
                {deleted: true, deletedAt: new Date()},
                {
                    where: {id: {[Op.in]: modelIds}, deleted: false},
                    transaction,
                    context: options.context,
                    individualHooks: true,
                },
            );

            await db.ai_model_share.update(
                {deleted: true, deletedAt: new Date()},
                {
                    where: {aiModelId: {[Op.in]: modelIds}, deleted: false},
                    transaction,
                    context: options.context,
                    individualHooks: true,
                },
            );

            // ai_budget uses `modelId`, not `aiModelId`.
            await db.ai_budget.update(
                {deleted: true, deletedAt: new Date()},
                {
                    where: {modelId: {[Op.in]: modelIds}, deleted: false},
                    transaction,
                    context: options.context,
                    individualHooks: true,
                },
            );

            await db.ai_hook_models.update(
                {deleted: true, deletedAt: new Date()},
                {
                    where: {aiModelId: {[Op.in]: modelIds}, deleted: false},
                    transaction,
                    context: options.context,
                    individualHooks: true,
                },
            );
        }

        /**
         * Disable linked models when the credential is disabled.
         *
         * @param {Object} credential Disabled credential instance.
         * @param {Object} options Sequelize hook options (transaction + context).
         */
        static async cascadeDisable(credential, options = {}) {
            await sequelize.models.ai_model.update(
                {enabled: false},
                {
                    where: {aiCredentialId: credential.id, deleted: false},
                    transaction: options.transaction,
                    context: options.context,
                    individualHooks: true,
                },
            );
        }
    }

    AiCredential.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        apiKey: DataTypes.TEXT,
        provider: DataTypes.STRING,
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
        modelName: 'ai_credential',
        tableName: 'ai_credential',
        hooks: {
            afterUpdate: async (credential, options) => {
                if (credential.deleted && !credential._previousDataValues.deleted) {
                    await AiCredential.cascadeSoftDelete(credential, options);
                    return;
                }
                if (
                    credential.enabled === false &&
                    credential._previousDataValues.enabled !== false
                ) {
                    await AiCredential.cascadeDisable(credential, options);
                }
            },
        },
    });

    return AiCredential;
};
