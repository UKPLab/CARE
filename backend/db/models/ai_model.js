'use strict';

/**
 * User-owned logical model configuration referencing credential rows (`ai_credential`).
 * Hooks ensure attached credentials remain valid for the same `userId`.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiModel extends MetaModel {
        static autoTable = true;
        static accessMap = [
            {
                table: "ai_model_share",
                by: "aiModelId",
                target: "id",
                columns: this.getAttributes(),
            },
        ];

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
