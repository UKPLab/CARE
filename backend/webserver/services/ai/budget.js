"use strict";

/**
 * AI budget enforcement, ai_log status management, and concurrency for chat requests.
 *
 * Cap walker (first failure denies the request):
 *   1. Model global cap        — ai_model.costLimit       (all users on this model)
 *   2. Model share per-user    — ai_model_share.costLimit (this user on this model)
 *   3. Hook global cap         — ai_hook.costLimit        (all users on this hook)
 *   4. Study global cap        — study.aiCostLimit        (all users in this study)
 *   5. Step-hook cap           — study_step.configuration.services[].costLimit
 *                                (per-user or per-session via applyPerSession)
 *
 * Each cap has its own resetAt; only ai_log rows at or after that timestamp
 * count toward the cap.
 *
 * Concurrency: one in-flight request per (userId, studySessionId).
 *
 * @module webserver/services/ai/budget
 * @author Mohammed Rawhani
 */

const { Op } = require("sequelize");

/**
 * Gate a new AI request: concurrency + cap walker, then create the ai_log row.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} request - The AI request envelope.
 * @param {number} request.userId - Authenticated user triggering the request.
 * @param {number} request.aiModelId - Model the request targets.
 * @param {number} [request.aiHookId] - Hook driving the request (if any).
 * @param {string} request.requestId - Client-generated request id.
 * @param {string} request.input - Serialized messages payload.
 * @param {number} [request.studyId] - Study scope when inside a study.
 * @param {number} [request.studySessionId] - Session scope when inside a study.
 * @param {number} [request.studyStepId] - Step scope when inside a study.
 * @param {number} [request.documentId] - Document id, when applicable.
 * @param {Object} [opts] - Options bundle.
 * @param {boolean} [opts.bypassChecks] - Skip access + cap checks (test prompts).
 * @returns {Promise<{ allowed: boolean, logId?: number, reason?: string }>}
 */
async function beginRequest(service, request, opts = {}) {
    const {
        userId,
        aiModelId,
        aiHookId,
        requestId,
        input,
        studyId,
        studySessionId,
        studyStepId,
        documentId,
    } = request || {};

    if (await _hasInflight(service, userId, studySessionId)) {
        return { allowed: false, reason: "You already have a pending AI request in this session" };
    }

    if (!opts.bypassChecks) {
        const model = await service.server.db.models["ai_model"].findByPk(aiModelId, { raw: true });
        if (!model || model.deleted || !model.enabled) {
            return { allowed: false, reason: "AI model is not available" };
        }

        // Inside a study, model access rides on the study owner. Participants
        // themselves are not required to hold a share; the study creator is.
        const accessHolderId = studyId
            ? await _getStudyOwnerId(service, studyId)
            : userId;
        if (!accessHolderId) {
            return { allowed: false, reason: "Study owner could not be resolved" };
        }

        const isOwner = model.userId === accessHolderId;
        const share = await _findUserShareForModel(service, accessHolderId, aiModelId);
        if (!isOwner && !share) {
            return {
                allowed: false,
                reason: studyId
                    ? "Study creator no longer has access to this AI model"
                    : "You do not have access to this AI model",
            };
        }

        const modelBlock = await _checkModelCap(service, model);
        if (modelBlock) return { allowed: false, reason: modelBlock };

        if (share) {
            const shareBlock = await _checkShareCap(service, share, accessHolderId);
            if (shareBlock) return { allowed: false, reason: shareBlock };
        }

        if (aiHookId) {
            const hookBlock = await _checkHookCap(service, aiHookId);
            if (hookBlock) return { allowed: false, reason: hookBlock };
        }

        if (studyId) {
            const studyBlock = await _checkStudyCap(service, studyId);
            if (studyBlock) return { allowed: false, reason: studyBlock };
        }

        if (studyStepId && aiHookId) {
            const stepHookBlock = await _checkStepHookCap(service, {
                studyStepId,
                aiHookId,
                userId,
                studySessionId,
            });
            if (stepHookBlock) return { allowed: false, reason: stepHookBlock };
        }
    }

    const log = await service.server.db.models["ai_log"].create({
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
 * Record a successful response: persist parsed outcome, flip status.
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id.
 * @param {Object} outcome - Pre-parsed fields ready for ai_log persistence.
 * @returns {Promise<void>}
 */
async function completeRequest(service, logId, outcome) {
    await service.server.db.models["ai_log"].update({
        ...outcome,
        status: "completed",
    }, { where: { id: logId } });
}

/**
 * Record a failed response: flip status, store error message in output.
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id returned from beginRequest.
 * @param {string} [errorMessage] - Human-readable error message to store.
 * @returns {Promise<void>}
 */
async function failRequest(service, logId, errorMessage) {
    await service.server.db.models["ai_log"].update({
        status: "failed",
        output: errorMessage || "Unknown error",
    }, { where: { id: logId } });
}

/**
 * Cancel the user's in-flight request: flip status to aborted.
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id to cancel.
 * @returns {Promise<{ cancelled: boolean }>}
 */
async function cancelRequest(service, logId) {
    await service.server.db.models["ai_log"].update(
        { status: "aborted" },
        { where: { id: logId } }
    );
    return { cancelled: true };
}

/**
 * Reset a share's cap window (single-row update).
 *
 * @param {Object} service - AIService instance.
 * @param {{ shareId: number }} request - Reset target.
 * @returns {Promise<void>}
 */
async function resetShareBudget(service, request) {
    const shareId = Number(request?.shareId);
    if (!Number.isInteger(shareId) || shareId <= 0) return;
    await service.server.db.models["ai_model_share"].update(
        { resetAt: new Date() },
        { where: { id: shareId } }
    );
}

/**
 * Reset a model's global cap window.
 *
 * @param {Object} service - AIService instance.
 * @param {{ modelId: number }} request - Reset target.
 * @returns {Promise<void>}
 */
async function resetModelBudget(service, request) {
    const modelId = Number(request?.modelId);
    if (!Number.isInteger(modelId) || modelId <= 0) return;
    await service.server.db.models["ai_model"].update(
        { resetAt: new Date() },
        { where: { id: modelId } }
    );
}

/**
 * Reset a hook's global cap window.
 *
 * @param {Object} service - AIService instance.
 * @param {{ hookId: number }} request - Reset target.
 * @returns {Promise<void>}
 */
async function resetHookBudget(service, request) {
    const hookId = Number(request?.hookId);
    if (!Number.isInteger(hookId) || hookId <= 0) return;
    await service.server.db.models["ai_hook"].update(
        { resetAt: new Date() },
        { where: { id: hookId } }
    );
}

/**
 * Reset a study's global cap window.
 *
 * @param {Object} service - AIService instance.
 * @param {{ studyId: number }} request - Reset target.
 * @returns {Promise<void>}
 */
async function resetStudyBudget(service, request) {
    const studyId = Number(request?.studyId);
    if (!Number.isInteger(studyId) || studyId <= 0) return;
    await service.server.db.models["study"].update(
        { aiResetAt: new Date() },
        { where: { id: studyId } }
    );
}

/// Internal helpers

/**
 * True if the user already has an in-flight request in this session.
 */
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

/**
 * Find the active (non-expired) share row for this (user, model) pair, if any.
 */
async function _findUserShareForModel(service, userId, aiModelId) {
    return service.server.db.models["ai_model_share"].findOne({
        where: {
            aiModelId,
            userId,
            deleted: false,
            expiryDate: { [Op.gt]: new Date() },
        },
        raw: true,
    });
}

/**
 * Resolve the owning userId for a study (the share/access-holder of record).
 *
 * @returns {Promise<number|null>} null when the study is missing or deleted.
 */
async function _getStudyOwnerId(service, studyId) {
    const study = await service.server.db.models["study"].findByPk(studyId, {
        attributes: ["userId", "deleted"],
        raw: true,
    });
    if (!study || study.deleted) return null;
    return Number(study.userId);
}

/**
 * Returns a deny reason if the model's global cap is exhausted, else null.
 */
async function _checkModelCap(service, model) {
    if (!model || model.costLimit == null) return null;
    const used = await _sumLogs(service, {
        where: { aiModelId: model.id },
        resetAt: model.resetAt,
    });
    if (used >= model.costLimit) {
        return `Model budget exhausted: $${used.toFixed(2)} / $${model.costLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Returns a deny reason if the share-holder's attributable cap is exhausted,
 * else null. Attributable usage = the share owner's direct logs plus logs by
 * any user inside studies owned by the share owner. Participants don't get
 * sliced here — that's the step-hook cap's job.
 */
async function _checkShareCap(service, share, ownerId) {
    if (!share || share.costLimit == null) return null;
    const used = await _sumLogsAttributableToOwner(service, share, ownerId);
    if (used >= share.costLimit) {
        return `Budget exceeded: $${used.toFixed(2)} / $${share.costLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Sum ai_log.costs attributable to the share owner: their direct usage on the
 * model + spend by anyone inside studies they own. Respects share.resetAt.
 */
async function _sumLogsAttributableToOwner(service, share, ownerId) {
    const Sequelize = service.server.db.Sequelize;
    const models = service.server.db.models;
    const base = {
        aiModelId: share.aiModelId,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (share.resetAt) base.createdAt = { [Op.gte]: share.resetAt };

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

/**
 * Returns a deny reason if the hook's global cap is exhausted, else null.
 */
async function _checkHookCap(service, aiHookId) {
    const hook = await service.server.db.models["ai_hook"].findByPk(aiHookId, { raw: true });
    if (!hook || hook.costLimit == null) return null;
    const used = await _sumLogs(service, {
        where: { aiHookId },
        resetAt: hook.resetAt,
    });
    if (used >= hook.costLimit) {
        return `Hook budget exhausted: $${used.toFixed(2)} / $${hook.costLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Returns a deny reason if the study's global cap is exhausted, else null.
 * The study scope joins study_session because ai_log only carries
 * studySessionId, not studyId.
 */
async function _checkStudyCap(service, studyId) {
    const study = await service.server.db.models["study"].findByPk(studyId, { raw: true });
    if (!study || study.aiCostLimit == null) return null;
    const used = await _sumLogsForStudy(service, study);
    if (used >= study.aiCostLimit) {
        return `Study budget exhausted: $${used.toFixed(2)} / $${study.aiCostLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Returns a deny reason if the per-hook cap on this step is exhausted.
 * The cap config lives in study_step.configuration.services[] keyed by hookId.
 * applyPerSession=true → sum is per-session; otherwise per-user-per-study.
 */
async function _checkStepHookCap(service, { studyStepId, aiHookId, userId, studySessionId }) {
    const step = await service.server.db.models["study_step"].findByPk(studyStepId, { raw: true });
    if (!step) return null;
    const services = Array.isArray(step.configuration?.services) ? step.configuration.services : [];
    const entry = services.find((row) => Number(row?.hookId) === Number(aiHookId));
    if (!entry || entry.costLimit == null) return null;

    const used = entry.applyPerSession
        ? await _sumLogs(service, {
            where: { aiHookId, userId, studySessionId: studySessionId ?? null },
            resetAt: entry.resetAt,
        })
        : await _sumLogsForHookInStudy(service, { aiHookId, userId, studyId: step.studyId, resetAt: entry.resetAt });

    if (used >= entry.costLimit) {
        return `Hook step budget exhausted: $${used.toFixed(2)} / $${Number(entry.costLimit).toFixed(2)}`;
    }
    return null;
}

/**
 * Generic ai_log sum over a where clause + optional resetAt cutoff.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} opts
 * @param {Object} opts.where - Sequelize where clause to apply.
 * @param {Date} [opts.resetAt] - Only logs at or after this count.
 * @returns {Promise<number>}
 */
async function _sumLogs(service, { where, resetAt }) {
    const Sequelize = service.server.db.Sequelize;
    const filter = {
        ...where,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (resetAt) filter.createdAt = { [Op.gte]: resetAt };

    const result = await service.server.db.models["ai_log"].findOne({
        where: filter,
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

/**
 * Sum ai_log.costs for every log under a study (joins study_session).
 */
async function _sumLogsForStudy(service, study) {
    const Sequelize = service.server.db.Sequelize;
    const where = {
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (study.aiResetAt) where.createdAt = { [Op.gte]: study.aiResetAt };

    const result = await service.server.db.models["ai_log"].findOne({
        where,
        include: [{
            model: service.server.db.models["study_session"],
            where: { studyId: study.id },
            required: true,
            attributes: [],
        }],
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

/**
 * Sum ai_log.costs for one user on one hook inside a single study
 * (per-user-per-study, the !applyPerSession step-hook scope).
 */
async function _sumLogsForHookInStudy(service, { aiHookId, userId, studyId, resetAt }) {
    const Sequelize = service.server.db.Sequelize;
    const where = {
        aiHookId,
        userId,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (resetAt) where.createdAt = { [Op.gte]: resetAt };

    const result = await service.server.db.models["ai_log"].findOne({
        where,
        include: [{
            model: service.server.db.models["study_session"],
            where: { studyId },
            required: true,
            attributes: [],
        }],
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

module.exports = {
    beginRequest,
    completeRequest,
    failRequest,
    cancelRequest,
    resetShareBudget,
    resetModelBudget,
    resetHookBudget,
    resetStudyBudget,
};
