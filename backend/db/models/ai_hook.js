'use strict';

/**
 * User-owned AI hook configuration connecting prompt templates, models, and output handling.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const {AI_HOOK_OUTPUT_MODES, normalizeAiHookOutputMode} = require('../../utils/aiHookOutputModes.js');
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class AiHook extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiHook.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiHook.belongsTo(models["template"], { foreignKey: "templateId", as: "template" });
            AiHook.hasMany(models["ai_hook_models"], { foreignKey: "aiHookId", as: "hookModels" });
        }

        static async getUserFilter(userId) {
            const shareRows = await sequelize.models.ai_hook_share.findAll({
                where: {
                    userId,
                    deleted: false,
                    expiryDate: {[Op.gt]: new Date()},
                },
                attributes: ["aiHookId"],
                raw: true,
            });
            const hookIds = [...new Set(shareRows.map((row) => Number(row.aiHookId)))]
                .filter((id) => Number.isInteger(id) && id > 0);
            return hookIds.length > 0 ? {id: {[Op.in]: hookIds}} : {id: -1};
        }

        static fields = [
            {
                key: "name",
                label: "Name",
                type: "text",
                required: true,
            },
            {
                key: "templateId",
                label: "Prompt Template",
                type: "select",
                required: true,
            },
            {
                key: "outputMode",
                label: "Output Mode",
                type: "select",
                required: true,
                default: AI_HOOK_OUTPUT_MODES.TEXT,
            },
        ];

        static validateOutputMode(aiHook) {
            aiHook.outputMode = normalizeAiHookOutputMode(
                aiHook.outputMode ?? AI_HOOK_OUTPUT_MODES.TEXT
            );
        }

        static validateOwner(aiHook, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const ownerUserId = Number(aiHook.userId ?? aiHook._previousDataValues?.userId);
            if (ownerUserId !== currentUserId) {
                throw new Error("You are not allowed to update this AI hook");
            }
        }
    }

    AiHook.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        templateId: DataTypes.INTEGER,
        outputMode: DataTypes.INTEGER,
        enabled: DataTypes.BOOLEAN,
        deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_hook',
        tableName: 'ai_hook',
        hooks: {
            beforeCreate: (aiHook) => {
                AiHook.validateOutputMode(aiHook);
            },
            beforeUpdate: (aiHook, options) => {
                AiHook.validateOwner(aiHook, options);
                AiHook.validateOutputMode(aiHook);
            },
        },
    });

    return AiHook;
};
