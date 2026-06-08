'use strict';

/**
 * Ordered fallback model entries for AI hooks.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiHookFallback extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiHookFallback.belongsTo(models["ai_hook"], { foreignKey: "aiHookId", as: "aiHook" });
            AiHookFallback.belongsTo(models["ai_model"], { foreignKey: "aiModelId", as: "model" });
        }

        static async getUserFilter(userId) {
            const {Op} = require("sequelize");
            const hooks = await sequelize.models.ai_hook.findAll({
                attributes: ["id"],
                where: {userId, deleted: false},
                raw: true,
            });
            const hookIds = hooks.map((hook) => hook.id).filter(Boolean);
            if (hookIds.length === 0) {
                return {aiHookId: -1};
            }
            return {aiHookId: {[Op.in]: hookIds}};
        }

        static async validateFallback(fallback, options = {}) {
            const userId = options?.context?.currentUserId;
            if (!userId) {
                return;
            }

            const hookId = fallback.aiHookId ?? fallback._previousDataValues?.aiHookId;
            if (!hookId) {
                throw new Error("AI hook is required for fallback models");
            }

            const hook = await sequelize.models.ai_hook.getById(
                hookId,
                {transaction: options.transaction}
            );
            if (!hook || hook.deleted || Number(hook.userId) !== Number(userId)) {
                throw new Error("You are not allowed to manage fallback models for this AI hook");
            }

            const aiModelId = fallback.aiModelId ?? fallback._previousDataValues?.aiModelId;
            if (aiModelId && Number(aiModelId) === Number(hook.aiModelId)) {
                throw new Error("Fallback model cannot be the same as the primary model");
            }
        }

        static fields = [
            {
                key: "aiHookId",
                label: "AI Hook",
                type: "select",
                required: true,
            },
            {
                key: "aiModelId",
                label: "Fallback Model",
                type: "select",
                required: true,
            },
            {
                key: "priority",
                label: "Priority",
                type: "number",
                required: true,
            },
        ];
    }

    AiHookFallback.init({
        aiHookId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        priority: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_hook_fallback',
        tableName: 'ai_hook_fallback',
        hooks: {
            beforeCreate: async (fallback, options) => {
                await AiHookFallback.validateFallback(fallback, options);
            },
            beforeUpdate: async (fallback, options) => {
                await AiHookFallback.validateFallback(fallback, options);
            },
        },
    });

    return AiHookFallback;
};
