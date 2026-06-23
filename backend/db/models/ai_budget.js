'use strict';

/**
 * AI budget cap rows. One row per cap; six entity kinds discriminated by
 * which FK column is non-null.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');
const { Op } = require("sequelize");
const { AI_BUDGET_LIMIT_TYPES } = require('../../utils/aiBudgetLimitTypes.js');

module.exports = (sequelize, DataTypes) => {
    class AiBudget extends MetaModel {
        // parentTables tells the framework to also load these parent rows
        // when ai_budget rows are sent. Same shape as study_session.autoTable.
        static autoTable = {
            parentTables: [
                { table: "ai_model",       by: "modelId"     },
                { table: "ai_model_share", by: "shareId"     },
                { table: "ai_hook",        by: "hookId"      },
                { table: "ai_hook_share",  by: "hookShareId" },
                { table: "study",          by: "studyId"     },
                { table: "study_step",     by: "studyStepId" },
            ],
        };

        static limitTypes = AI_BUDGET_LIMIT_TYPES;

        // Visibility scope: a cap row is visible to the user that owns the
        // referenced entity. Six entity kinds → six OR branches, mirroring
        // the OR pattern in ai_hook.getUserFilter (just with broader reach).
        static async getUserFilter(userId) {
            const db = sequelize.models;
            const orEmpty = (ids) => (ids.length > 0 ? ids : [-1]);

            const [models, hooks, studies] = await Promise.all([
                db.ai_model.findAll({ where: { userId, deleted: false }, attributes: ["id"], raw: true }),
                db.ai_hook.findAll({ where: { userId, deleted: false }, attributes: ["id"], raw: true }),
                db.study.findAll({ where: { userId, deleted: false }, attributes: ["id"], raw: true }),
            ]);
            const modelIds = models.map((m) => m.id);
            const hookIds  = hooks.map((h) => h.id);
            const studyIds = studies.map((s) => s.id);

            const [shares, hookShares, steps] = await Promise.all([
                modelIds.length === 0 ? [] : db.ai_model_share.findAll({
                    where: { aiModelId: { [Op.in]: modelIds }, deleted: false },
                    attributes: ["id"], raw: true,
                }),
                hookIds.length === 0 ? [] : db.ai_hook_share.findAll({
                    where: { aiHookId: { [Op.in]: hookIds }, deleted: false },
                    attributes: ["id"], raw: true,
                }),
                studyIds.length === 0 ? [] : db.study_step.findAll({
                    where: { studyId: { [Op.in]: studyIds }, deleted: false },
                    attributes: ["id"], raw: true,
                }),
            ]);
            const shareIds = shares.map((s) => s.id);
            const hookShareIds = hookShares.map((s) => s.id);
            const stepIds = steps.map((s) => s.id);

            return {
                [Op.or]: [
                    { modelId: { [Op.in]: orEmpty(modelIds)      } },
                    { shareId: { [Op.in]: orEmpty(shareIds)      } },
                    { hookId: { [Op.in]: orEmpty(hookIds)       } },
                    { hookShareId:  { [Op.in]: orEmpty(hookShareIds)  } },
                    { studyId: { [Op.in]: orEmpty(studyIds)      } },
                    { studyStepId: { [Op.in]: orEmpty(stepIds)       } },
                ],
            };
        }

        static associate(models) {
            AiBudget.belongsTo(models["ai_model"], { foreignKey: "modelId", as: "model" });
            AiBudget.belongsTo(models["ai_model_share"], { foreignKey: "shareId", as: "share" });
            AiBudget.belongsTo(models["ai_hook"], { foreignKey: "hookId", as: "hook" });
            AiBudget.belongsTo(models["ai_hook_share"], { foreignKey: "hookShareId", as: "hookShare" });
            AiBudget.belongsTo(models["study"], { foreignKey: "studyId", as: "study" });
            AiBudget.belongsTo(models["study_step"], { foreignKey: "studyStepId", as: "studyStep" });
        }

        // Ownership check fired from beforeCreate/beforeUpdate. Mirrors
        // ai_hook.validateOwner shape — reads options.context.currentUserId,
        // walks 0-2 lookups based on which FK pattern this cap uses, throws
        // if the caller doesn't own the referenced entity.
        static async validateOwner(aiBudget, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const transaction = options.transaction;
            const db = sequelize.models;

            const modelId = Number(aiBudget.modelId ?? aiBudget._previousDataValues?.modelId)      || null;
            const shareId = Number(aiBudget.shareId ?? aiBudget._previousDataValues?.shareId)      || null;
            const hookId = Number(aiBudget.hookId ?? aiBudget._previousDataValues?.hookId)       || null;
            const hookShareId  = Number(aiBudget.hookShareId  ?? aiBudget._previousDataValues?.hookShareId)  || null;
            const studyId = Number(aiBudget.studyId ?? aiBudget._previousDataValues?.studyId)      || null;
            const studyStepId  = Number(aiBudget.studyStepId ?? aiBudget._previousDataValues?.studyStepId)  || null;

            const assertOwner = (entity, message) => {
                  if (!entity || Number(entity.userId) !== currentUserId) {
                    throw new Error(message);
                }
            };

            if (modelId && !shareId && !hookId && !hookShareId && !studyId && !studyStepId) {
                const model = await db.ai_model.findByPk(modelId, { transaction, raw: true });
                assertOwner(model, "You do not own this AI model");
                return;
            }
            if (shareId) {
                const share = await db.ai_model_share.findByPk(shareId, { transaction, raw: true });
                if (!share) throw new Error("Share not found");
                const model = await db.ai_model.findByPk(share.aiModelId, { transaction, raw: true });
                assertOwner(model, "You do not own this AI model");
                return;
            }
            if (studyStepId && hookId) {
                const step = await db.study_step.findByPk(studyStepId, { transaction, raw: true });
                if (!step) throw new Error("Study step not found");
                const study = await db.study.findByPk(step.studyId, { transaction, raw: true });
                assertOwner(study, "You do not own this study");
                return;
            }
            if (hookId && !studyStepId) {
                const hook = await db.ai_hook.findByPk(hookId, { transaction, raw: true });
                assertOwner(hook, "You do not own this AI hook");
                return;
            }
            if (hookShareId) {
                const hookShare = await db.ai_hook_share.findByPk(hookShareId, { transaction, raw: true });
                if (!hookShare) throw new Error("Hook share not found");
                const hook = await db.ai_hook.findByPk(hookShare.aiHookId, { transaction, raw: true });
                assertOwner(hook, "You do not own this AI hook");
                return;
            }
            if (studyId) {
                const study = await db.study.findByPk(studyId, { transaction, raw: true });
                assertOwner(study, "You do not own this study");
                return;
            }
            throw new Error("Invalid budget scope");
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
                await AiBudget.validateOwner(aiBudget, options);
            },
            beforeUpdate: async (aiBudget, options) => {
                await AiBudget.validateOwner(aiBudget, options);
            },
        },
    });

    return AiBudget;
};
