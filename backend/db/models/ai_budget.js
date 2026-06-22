'use strict';

/**
 * AI budget cap rows. One row per cap; six entity kinds discriminated by
 * which FK column is non-null.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');
const { AI_BUDGET_LIMIT_TYPES } = require('../../utils/aiBudgetLimitTypes.js');

module.exports = (sequelize, DataTypes) => {
    class AiBudget extends MetaModel {
        static autoTable = false;
        static limitTypes = AI_BUDGET_LIMIT_TYPES;

        static associate(models) {
            AiBudget.belongsTo(models["ai_model"], { foreignKey: "modelId", as: "model" });
            AiBudget.belongsTo(models["ai_model_share"], { foreignKey: "shareId", as: "share" });
            AiBudget.belongsTo(models["ai_hook"], { foreignKey: "hookId", as: "hook" });
            AiBudget.belongsTo(models["ai_hook_share"], { foreignKey: "hookShareId", as: "hookShare" });
            AiBudget.belongsTo(models["study"], { foreignKey: "studyId", as: "study" });
            AiBudget.belongsTo(models["study_step"], { foreignKey: "studyStepId", as: "studyStep" });
        }
    }

    AiBudget.init({
        modelId: DataTypes.INTEGER,
        shareId: DataTypes.INTEGER,
        hookId: DataTypes.INTEGER,
        hookShareId: DataTypes.INTEGER,
        studyId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        limitType: DataTypes.INTEGER,
        costLimit: DataTypes.DECIMAL(18, 6),
        resetAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_budget',
        tableName: 'ai_budget',
    });

    return AiBudget;
};
