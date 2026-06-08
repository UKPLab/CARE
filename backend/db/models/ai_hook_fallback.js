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
    });

    return AiHookFallback;
};
