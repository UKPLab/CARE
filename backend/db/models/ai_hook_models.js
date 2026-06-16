'use strict';

/**
 * Ordered AI models for an AI hook.
 * Priority 1 is the primary model; priority 2+ are fallback models.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiHookModels extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiHookModels.belongsTo(models["ai_hook"], { foreignKey: "aiHookId", as: "hook" });
            AiHookModels.belongsTo(models["ai_model"], { foreignKey: "aiModelId", as: "model" });
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

        static async validateHookModel(hookModel, options = {}) {
            const userId = options?.context?.currentUserId;
            if (!userId) {
                return;
            }

            const hookId = hookModel.aiHookId ?? hookModel._previousDataValues?.aiHookId;
            if (!hookId) {
                throw new Error("AI hook is required for hook models");
            }

            const hook = await sequelize.models.ai_hook.getById(
                hookId,
                {transaction: options.transaction}
            );
            if (!hook || hook.deleted || Number(hook.userId) !== Number(userId)) {
                throw new Error("You are not allowed to manage models for this AI hook");
            }

            const priority = Number(hookModel.priority ?? hookModel._previousDataValues?.priority);
            if (!Number.isInteger(priority) || priority < 1) {
                throw new Error("AI hook model priority must be at least 1");
            }

            const aiModelId = Number(hookModel.aiModelId ?? hookModel._previousDataValues?.aiModelId);
            const existingRows = await sequelize.models.ai_hook_models.findAll({
                attributes: ["id", "aiModelId", "priority"],
                where: {aiHookId: hookId, deleted: false},
                raw: true,
                transaction: options.transaction,
            });
            const currentId = Number(hookModel.id);

            const hasDuplicatePriority = existingRows.some(
                (row) => Number(row.id) !== currentId && Number(row.priority) === priority
            );
            if (hasDuplicatePriority) {
                throw new Error("AI hook model priority must be unique for this hook");
            }

            const primaryRow = existingRows.find((row) => Number(row.priority) === 1);
            if (
                priority > 1 &&
                primaryRow &&
                Number(primaryRow.id) !== currentId &&
                Number(primaryRow.aiModelId) === aiModelId
            ) {
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
                label: "Model",
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

    AiHookModels.init({
        aiHookId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        priority: DataTypes.INTEGER,
        additionalParameters: DataTypes.JSONB,
        deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_hook_models',
        tableName: 'ai_hook_models',
        hooks: {
            beforeCreate: async (hookModel, options) => {
                await AiHookModels.validateHookModel(hookModel, options);
            },
            beforeUpdate: async (hookModel, options) => {
                await AiHookModels.validateHookModel(hookModel, options);
            },
        },
    });

    return AiHookModels;
};
