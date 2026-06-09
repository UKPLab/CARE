'use strict';

/**
 * User-owned AI hook configuration connecting prompt templates, models, and output handling.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const {AI_HOOK_OUTPUT_MODES, normalizeAiHookOutputMode} = require('../../utils/aiHookOutputModes.js');

module.exports = (sequelize, DataTypes) => {
    class AiHook extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiHook.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiHook.belongsTo(models["template"], { foreignKey: "templateId", as: "template" });
            AiHook.hasMany(models["ai_hook_models"], { foreignKey: "aiHookId", as: "hookModels" });
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
    }

    AiHook.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        templateId: DataTypes.INTEGER,
        outputMode: DataTypes.INTEGER,
        enabled: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
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
            beforeUpdate: (aiHook) => {
                AiHook.validateOutputMode(aiHook);
            },
        },
    });

    return AiHook;
};
