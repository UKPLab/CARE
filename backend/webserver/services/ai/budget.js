"use strict";

/**
 * Checks budgets before AI requests and tracks each request in ai_log.
 * All cap rows live in the ai_budget table. Each request loads the caps
 * that apply, sums the related spend, and denies on the first one that's full.
 *
 * @module webserver/services/ai/budget
 * @author Mohammed Rawhani
 */

const { Op } = require("sequelize");
const { AI_BUDGET_LIMIT_TYPES: LT } = require("../../../utils/aiBudgetLimitTypes");

/**
 * Decides if an AI request can run. If yes, creates the ai_log row for it.
 * Blocks a second request from the same user in the same session while one is still running.
 *
 * @param {Object} service - AIService, used for DB access.
 * @param {Object} request - The request being made (user, model, hook, study, etc).
 * @param {Object} [opts]
 * @param {boolean} [opts.bypassChecks] - Skip the access + cap checks (used for admin test prompts).
 * @returns {Promise<{ allowed: boolean, logId?: number, reason?: string }>}
 */
async function beginRequest(service, request, opts = {}) {
    const {
        userId, aiModelId, aiHookId, requestId, input,
        studyId, studySessionId, studyStepId, documentId,
    } = request || {};

    if (await _hasInflight(service, userId, studySessionId)) {
        return { allowed: false, reason: "You already have a pending AI request in this session" };
    }

    if (!opts.bypassChecks) {
        const model = await service.server.db.models["ai_model"].findByPk(aiModelId, { raw: true });
        if (!model || model.deleted || !model.enabled) {
            return { allowed: false, reason: "AI model is not available" };
        }

        // Inside a study, access (and per-share budget attribution) rides on the
        // study owner — participants don't carry shares.
        const accessHolderId = studyId
            ? await _getStudyOwnerId(service, studyId)
            : userId;
        if (!accessHolderId) {
            return { allowed: false, reason: "Study owner could not be resolved" };
        }

        const isModelOwner = model.userId === accessHolderId;
        const modelShare = await _findActiveShare(service, "ai_model_share", "aiModelId", accessHolderId, aiModelId);
        if (!isModelOwner && !modelShare) {
            return {
                allowed: false,
                reason: studyId
                    ? "Study creator no longer has access to this AI model"
                    : "You do not have access to this AI model",
            };
        }

        if (!model.freeModel) {
            // We look up hookShare only to know if there is a hook-share budget to check.
            //We are not checking whether the user is allowed to use the hook here.
             const hookShare = aiHookId
                ? await _findActiveShare(service, "ai_hook_share", "aiHookId", accessHolderId, aiHookId)
                : null;

            const caps = await _loadApplicableCaps(service, {
                modelId: aiModelId,
                shareId: modelShare?.id,
                hookId: aiHookId,
                hookShareId: hookShare?.id,
                studyId,
                studyStepId,
            });

            for (const cap of caps) {
                const used = await _sumLogsFor(service, cap, { userId, studySessionId, accessHolderId });
                if (used >= cap.costLimit) {
                    return { allowed: false, reason: _capDenyMessage(cap, used) };
                }
            }
        }
    }

    const log = await service.server.db.models["ai_log"].add({
        userId,
        aiModelId,
        aiHookId: aiHookId || null,
        documentId: documentId || null,
        studySessionId: studySessionId || null,
        studyStepId: studyStepId || null,
        requestId,
        input,
        status: "in_progress",
        requestStart: new Date(),
    });
    return { allowed: true, logId: log.id };
}

/**
 * Marks a request as completed and saves the provider response.
 *
 * @param {Object} service - AIService, used for DB access.
 * @param {number} logId - The ai_log row id returned by beginRequest.
 * @param {Object} outcome - Parsed response fields to save (output, tokens, costs, etc).
 */
async function completeRequest(service, logId, outcome) {
    await service.server.db.models["ai_log"].updateById(logId, {
        ...outcome,
        status: "completed",
    });
}

/**
 * Marks a request as failed and stores the error.
 *
 * @param {Object} service - AIService, used for DB access.
 * @param {number} logId - The ai_log row id returned by beginRequest.
 * @param {string} [errorMessage] - Error text to save on the log row.
 */
async function failRequest(service, logId, errorMessage) {
    await service.server.db.models["ai_log"].updateById(logId, {
        status: "failed",
        output: errorMessage || "Unknown error",
    });
}

/**
 * Marks a running request as aborted (used after the caller stops it at the provider).
 *
 * @param {Object} service - AIService, used for DB access.
 * @param {number} logId - The ai_log row id returned by beginRequest.
 */
async function cancelRequest(service, logId) {
    await service.server.db.models["ai_log"].updateById(logId, { status: "aborted" });
    return { cancelled: true };
}


/// Internal helpers

// True if this user already has a request running in this session.
async function _hasInflight(service, userId, studySessionId) {
    const existing = await service.server.db.models["ai_log"].findOne({
        where: {
            userId,
            studySessionId: studySessionId ?? null,
            status: "in_progress",
            deleted: false,
        },
        attributes: ["id"],
    });
    return existing !== null;
}

// Returns the userId of the study's owner, or null if the study is gone.
async function _getStudyOwnerId(service, studyId) {
    const study = await service.server.db.models["study"].findByPk(studyId, {
        attributes: ["userId", "deleted"],
        raw: true,
    });
    if (!study || study.deleted) return null;
    return Number(study.userId);
}

// Returns the user's active (non-expired) share row for a model or hook, or null.
// One function handles both share tables since they have the same shape.
async function _findActiveShare(service, tableName, fkColumn, userId, entityId) {
    const roleIds = await service.server.db.models["user_role_matching"].getUserRolesById(userId);
    return service.server.db.models[tableName].findOne({
        where: {
            [fkColumn]: entityId,
            deleted: false,
            expiryDate: { [Op.gt]: new Date() },
            [Op.or]: [
                { userId },
                ...(roleIds.length ? [{ roleId: { [Op.in]: roleIds } }] : []),
            ],
        },
        raw: true,
    });
}

// Loads every cap row that could apply to this request (model, share, hook,
// hook share, study, step-hook) in one DB query.
async function _loadApplicableCaps(service, ctx) {
    const orClauses = [];
    if (ctx.modelId)      orClauses.push({ modelId: ctx.modelId });
    if (ctx.shareId)      orClauses.push({ shareId: ctx.shareId });
    if (ctx.hookShareId)  orClauses.push({ hookShareId: ctx.hookShareId });
    if (ctx.studyId)      orClauses.push({ studyId: ctx.studyId });
    if (ctx.hookId)       orClauses.push({ hookId: ctx.hookId, studyStepId: null });
    if (ctx.studyStepId && ctx.hookId) {
        orClauses.push({ studyStepId: ctx.studyStepId, hookId: ctx.hookId });
    }
    if (orClauses.length === 0) return [];

    return service.server.db.models["ai_budget"].findAll({
        where: { deleted: false, [Op.or]: orClauses },
        raw: true,
    });
}

// Picks the right sum function for this cap row based on its FKs and limitType.
// service: DB access. cap: an ai_budget row. ctx: { userId, studySessionId, accessHolderId }.
async function _sumLogsFor(service, cap, ctx) {
    if (cap.modelId)      return _sumModelTotal(service, cap);
    if (cap.shareId)      return _sumShareAttributable(service, cap, ctx.accessHolderId);
    if (cap.hookShareId)  return _sumHookShareAttributable(service, cap, ctx.accessHolderId);
    // before hook id condition 
    if (cap.studyStepId && cap.hookId) {
        if (cap.limitType === LT.PER_SESSION) return _sumStepHookSession(service, cap, ctx);
        if (cap.limitType === LT.PER_USER)    return _sumStepHookUser(service, cap, ctx);
        return _sumStepHookTotal(service, cap);
    }
    if (cap.hookId && !cap.studyStepId) return _sumHookTotal(service, cap);
    if (cap.studyId) {
        if (cap.limitType === LT.PER_SESSION) return _sumStudySession(service, cap, ctx);
        if (cap.limitType === LT.PER_USER)    return _sumStudyUser(service, cap, ctx);
        return _sumStudyTotal(service, cap);
    }
    return 0;
}

// Human-readable deny message for the cap that blocked the request.
function _capDenyMessage(cap, used) {
    const limit = Number(cap.costLimit).toFixed(2);
    const spent = used.toFixed(2);
    if (cap.modelId)      return `Model budget exhausted: $${spent} / $${limit}`;
    if (cap.shareId)      return `Model share budget exhausted: $${spent} / $${limit}`;
    if (cap.hookShareId)  return `Hook share budget exhausted: $${spent} / $${limit}`;
    if (cap.studyStepId)  return `Step-hook budget exhausted: $${spent} / $${limit}`;
    if (cap.hookId)       return `Hook budget exhausted: $${spent} / $${limit}`;
    if (cap.studyId)      return `Study budget exhausted: $${spent} / $${limit}`;
    return `Budget exhausted: $${spent} / $${limit}`;
}

/// Sum helpers

// Sums ai_log.costs for any WHERE the caller passes. Skips logs older than resetAt if set.
async function _sumLogs(service, where, resetAt, include = []) {
    const Sequelize = service.server.db.Sequelize;
    const filter = {
        ...where,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (resetAt) filter.createdAt = { [Op.gte]: resetAt };

    const result = await service.server.db.models["ai_log"].findOne({
        where: filter,
        include,
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

async function _sumModelTotal(service, cap) {
    return _sumLogs(service, { aiModelId: cap.modelId }, cap.resetAt);
}

async function _sumHookTotal(service, cap) {
    return _sumLogs(service, { aiHookId: cap.hookId }, cap.resetAt);
}

async function _sumStudyTotal(service, cap) {
    return _sumLogs(service, {}, cap.resetAt, [{
        model: service.server.db.models["study_session"],
        where: { studyId: cap.studyId },
        required: true,
        attributes: [],
    }]);
}

async function _sumStudySession(service, cap, ctx) {
    if (!ctx.studySessionId) return 0;
    return _sumLogs(service, { studySessionId: ctx.studySessionId }, cap.resetAt);
}

async function _sumStudyUser(service, cap, ctx) {
    return _sumLogs(service, { userId: ctx.userId }, cap.resetAt, [{
        model: service.server.db.models["study_session"],
        where: { studyId: cap.studyId },
        required: true,
        attributes: [],
    }]);
}

// count hook usage but only inside this study
async function _sumStepHookTotal(service, cap) {
    const step = await service.server.db.models["study_step"].findByPk(cap.studyStepId, {
        attributes: ["studyId"],
        raw: true,
    });
    if (!step) return 0;
    return _sumLogs(service, { aiHookId: cap.hookId }, cap.resetAt, [{
        model: service.server.db.models["study_session"],
        where: { studyId: step.studyId },
        required: true,
        attributes: [],
    }]);
}

// count hook usage inside this session
async function _sumStepHookSession(service, cap, ctx) {
    if (!ctx.studySessionId) return 0;
    return _sumLogs(service, {
        aiHookId: cap.hookId,
        studySessionId: ctx.studySessionId,
    }, cap.resetAt);
}

// sum for this user using hook across all their sessions within this study
async function _sumStepHookUser(service, cap, ctx) {
    const step = await service.server.db.models["study_step"].findByPk(cap.studyStepId, {
        attributes: ["studyId"],
        raw: true,
    });
    if (!step) return 0;
    return _sumLogs(service, {
        aiHookId: cap.hookId,
        userId: ctx.userId,
    }, cap.resetAt, [{
        model: service.server.db.models["study_session"],
        where: { studyId: step.studyId },
        required: true,
        attributes: [],
    }]);
}

// Spend on this model that belongs to the share owner: their own usage
// plus anyone using it inside studies they own.
async function _sumShareAttributable(service, cap, ownerId) {
    const share = await service.server.db.models["ai_model_share"].findByPk(cap.shareId, {
        attributes: ["aiModelId"],
        raw: true,
    });
    if (!share) return 0;
    return _sumAttributableForEntity(service, { aiModelId: share.aiModelId }, ownerId, cap.resetAt);
}

// Same as _sumShareAttributable but for hooks instead of models.
async function _sumHookShareAttributable(service, cap, ownerId) {
    const hookShare = await service.server.db.models["ai_hook_share"].findByPk(cap.hookShareId, {
        attributes: ["aiHookId"],
        raw: true,
    });
    if (!hookShare) return 0;
    return _sumAttributableForEntity(service, { aiHookId: hookShare.aiHookId }, ownerId, cap.resetAt);
}

// Owner's own usage on the entity + usage by anyone in studies they own.
// entityWhere narrows to one model or one hook.
async function _sumAttributableForEntity(service, entityWhere, ownerId, resetAt) {
    const Sequelize = service.server.db.Sequelize;
    const models = service.server.db.models;
    const base = {
        ...entityWhere,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (resetAt) base.createdAt = { [Op.gte]: resetAt };

    const direct = await models["ai_log"].findOne({
        where: { ...base, userId: ownerId },
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });

    const studyOwned = await models["ai_log"].findOne({
        where: { ...base, userId: { [Op.ne]: ownerId } },
        include: [{
            model: models["study_session"],
            required: true,
            attributes: [],
            include: [{
                model: models["study"],
                as: "study",
                required: true,
                where: { userId: ownerId },
                attributes: [],
            }],
        }],
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });

    return parseFloat(direct?.total || 0) + parseFloat(studyOwned?.total || 0);
}

module.exports = {
    beginRequest,
    completeRequest,
    failRequest,
    cancelRequest,
};
