'use strict';

/**
 * User-owned logical model configuration referencing credential rows (`ai_credential`).
 * Hooks ensure attached credentials remain valid for the same `userId`.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class AiModel extends MetaModel {
        // Cascade ai_model_share rows to anyone subscribing to ai_model, and the
        // owner's user row back to anyone the model is shared with.
        static autoTable = {
            foreignTables: [
                { table: "ai_model_share", by: "aiModelId" },
            ],
            parentTables: [
                { table: "user", by: "userId" },
            ],
        };

        /**
         * Grants row visibility to anyone with an active direct-user or role-based
         * ai_model_share grant for this model, in addition to the owner (handled by
         * the base autoTable userId rule).
         *
         * @param {number} userId Viewer's id.
         * @returns {Promise<object>}
         */
        static async getUserFilter(userId) {
            const roleIds = await sequelize.models.user_role_matching.getUserRolesById(userId);
            const shareRows = await sequelize.models.ai_model_share.findAll({
                where: {
                    deleted: false,
                    expiryDate: {[Op.gt]: new Date()},
                    [Op.or]: [
                        {userId},
                        ...(roleIds.length ? [{roleId: {[Op.in]: roleIds}}] : []),
                    ],
                },
                attributes: ["aiModelId"],
                raw: true,
            });
            const modelIds = [...new Set(shareRows.map((row) => Number(row.aiModelId)))]
                .filter((id) => Number.isInteger(id) && id > 0);
            return modelIds.length > 0 ? {id: {[Op.in]: modelIds}} : {id: -1};
        }

        /**
         * Ensures linked credentials exist, belong to this model owner, and allow enablement semantics.
         *
         * @param {import('sequelize').Model} aiModel Mutated instance triggering the hook.
         * @param {{ transaction?: import('sequelize').Transaction }} [options={}] Sequelize hook options bundle.
         */
        static async validateCredentialOwnership(aiModel, options = {}) {
            if (!aiModel.aiCredentialId) {
                return;
            }

            const credential = await sequelize.models.ai_credential.findByPk(aiModel.aiCredentialId, {
                transaction: options.transaction,
            });

            if (!credential || credential.deleted) {
                throw new Error("Selected AI credential does not exist");
            }

            if (credential.userId !== aiModel.userId) {
                throw new Error("Selected AI credential does not belong to this user");
            }

            if (!credential.enabled && aiModel.enabled) {
                throw new Error("Cannot enable this model while its credential is disabled");
            }
        }
    }

    AiModel.init({
        aiCredentialId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        model: DataTypes.STRING,
        description: DataTypes.TEXT,
        additionalParameters: DataTypes.JSONB,
        enabled: DataTypes.BOOLEAN,
        freeModel: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_model',
        tableName: 'ai_model',
        hooks: {
            beforeCreate: async (aiModel, options) => {
                await AiModel.validateCredentialOwnership(aiModel, options);
            },
            beforeUpdate: async (aiModel, options) => {
                await AiModel.validateCredentialOwnership(aiModel, options);
            },
        },
    });

    return AiModel;
};
