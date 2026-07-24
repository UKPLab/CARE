'use strict';

/**
 * AI budget cap rows. One row per cap; six entity kinds discriminated by which FK column is non-null.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');

// Discriminates ai_budget.limitType. Caps on model / model_share / hook / hook_share are always TOTAL 
const AI_BUDGET_LIMIT_TYPES = Object.freeze({
    TOTAL: 0,
    PER_SESSION: 1,
    PER_USER: 2,
});

module.exports = (sequelize, DataTypes) => {
    class AiBudget extends MetaModel {
        static limitTypes = AI_BUDGET_LIMIT_TYPES;

        // parentTables tells the framework to also load these parent rows
        // when ai_budget rows are sent. Same shape as study_session.autoTable.
        static autoTable = {
            parentTables: [
                { table: "ai_model", by: "modelId" },
                { table: "ai_model_share", by: "shareId" },
                { table: "ai_hook", by: "hookId" },
                { table: "ai_hook_share",  by: "hookShareId" },
                { table: "study", by: "studyId" },
                { table: "study_step", by: "studyStepId" },
            ],
        };
         // userId is denormalized on each row so visibility is a direct column filter — no FK-chain queries at read time.
        static async getUserFilter(userId) {
            return { userId };
        }

        static associate(models) {
            AiBudget.belongsTo(models["ai_model"], { foreignKey: "modelId", as: "model" });
            AiBudget.belongsTo(models["ai_model_share"], { foreignKey: "shareId", as: "share" });
            AiBudget.belongsTo(models["ai_hook"], { foreignKey: "hookId", as: "hook" });
            AiBudget.belongsTo(models["ai_hook_share"],  { foreignKey: "hookShareId", as: "hookShare" });
            AiBudget.belongsTo(models["study"], { foreignKey: "studyId", as: "study" });
            AiBudget.belongsTo(models["study_step"], { foreignKey: "studyStepId", as: "studyStep" });
        }

        // Walk the FK chain to find which user owns the referenced entity.
        // Called once at create time to resolve + stamp userId on the new row.
        static async _resolveOwnerUserId(aiBudget, db, transaction) {
            const modelId= Number(aiBudget.modelId)|| null;
            const shareId = Number(aiBudget.shareId)|| null;
            const hookId = Number(aiBudget.hookId)|| null;
            const hookShareId = Number(aiBudget.hookShareId) || null;
            const studyId = Number(aiBudget.studyId) || null;
            const studyStepId = Number(aiBudget.studyStepId) || null;

            if (modelId) {
                const m = await db.ai_model.findByPk(modelId, { transaction, raw: true });
                return m ? Number(m.userId) : null;
            }
            if (shareId) {
                const s = await db.ai_model_share.findByPk(shareId, { transaction, raw: true });
                if (!s) return null;
                const m = await db.ai_model.findByPk(s.aiModelId, { transaction, raw: true });
                return m ? Number(m.userId) : null;
            }
            if (hookShareId) {
                const hs = await db.ai_hook_share.findByPk(hookShareId, { transaction, raw: true });
                if (!hs) return null;
                const h = await db.ai_hook.findByPk(hs.aiHookId, { transaction, raw: true });
                return h ? Number(h.userId) : null;
            }
            if (studyStepId && hookId) {
                const ss = await db.study_step.findByPk(studyStepId, { transaction, raw: true });
                if (!ss) return null;
                const s = await db.study.findByPk(ss.studyId, { transaction, raw: true });
                return s ? Number(s.userId) : null;
            }
            if (hookId) {
                const h = await db.ai_hook.findByPk(hookId, { transaction, raw: true });
                return h ? Number(h.userId) : null;
            }
            if (studyId) {
                const s = await db.study.findByPk(studyId, { transaction, raw: true });
                return s ? Number(s.userId) : null;
            }
            return null;
        }

        // On create: resolve the entity's owner, stamp it on the row, verify the caller matches. 
        static async validateCreate(aiBudget, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) return;

            const resolvedOwnerId = await AiBudget._resolveOwnerUserId(
                aiBudget, sequelize.models, options.transaction
            );
            if (!resolvedOwnerId) throw new Error("Invalid budget scope");
            if (resolvedOwnerId !== currentUserId) throw new Error("You do not own this entity");
            aiBudget.userId = resolvedOwnerId;
        }

        // On update: userId is already stored — one compare, no FK walk.
        static async validateUpdate(aiBudget, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) return;

            const storedOwnerId = Number(aiBudget._previousDataValues?.userId);
            if (storedOwnerId !== currentUserId) throw new Error("You do not own this budget");
        }
    }

    AiBudget.init({
        userId: DataTypes.INTEGER,
        modelId: DataTypes.INTEGER,
        shareId: DataTypes.INTEGER,
        hookId: DataTypes.INTEGER,
        hookShareId: DataTypes.INTEGER,
        studyId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        limitType: DataTypes.INTEGER,
        costLimit: DataTypes.DECIMAL(18, 6),
        resetAt: DataTypes.DATE,
        deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_budget',
        tableName: 'ai_budget',
        hooks: {
            beforeCreate: async (aiBudget, options) => {
                await AiBudget.validateCreate(aiBudget, options);
            },
            beforeUpdate: async (aiBudget, options) => {
                await AiBudget.validateUpdate(aiBudget, options);
            },
        },
    });

    return AiBudget;
};

module.exports.AI_BUDGET_LIMIT_TYPES = AI_BUDGET_LIMIT_TYPES;
