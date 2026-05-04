'use strict';
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

        static validateModelOwnership(aiModel, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }

            if (Number(aiModel.userId) !== currentUserId) {
                throw new Error("You can only update AI models that you own");
            }
        }
    }

    AiModel.init({
        aiCredentialId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        model: DataTypes.STRING,
        provider: DataTypes.STRING,
        description: DataTypes.TEXT,
        additionalParameters: DataTypes.JSONB,
        enabled: DataTypes.BOOLEAN,
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
                AiModel.validateModelOwnership(aiModel, options);
                await AiModel.validateCredentialOwnership(aiModel, options);
            },
            beforeUpdate: async (aiModel, options) => {
                AiModel.validateModelOwnership(aiModel, options);
                await AiModel.validateCredentialOwnership(aiModel, options);
            },
        },
    });

    return AiModel;
};
