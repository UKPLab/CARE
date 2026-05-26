"use strict";

/**
 * AI budget enforcement, ai log status management, and concurrency for chat requests.
 *   - Two caps are checked per request, both must pass:
 *       1. Model global cap   (ai_model.costLimit) — sum across all users
 *       2. Per-user share cap (ai_model_share.costLimit) — this user's spend
 *   - Each cap has its own resetAt.
 *   - One in-flight request per (userId, studySessionId). Second is rejected.
 *   - Usage is computed from ai_log on demand.
 *   - In-flight ai_log rows have NULL cost and contribute $0 to sums.
 *   - 
 *
 * @module webserver/services/ai/budget
 * @author Mohammed Rawhani
 */

const { Op } = require("sequelize");


/**
 * Gate a new AI request: concurrency + both caps, then create the ai_log row.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} request - The AI request object,  assembled by any file calls it when requesting.
 * @param {number} request.userId - Authenticated user triggering the request.
 * @param {number} request.aiModelId - Model the request targets.
 * @param {string} request.requestId - client-generated id.
 * @param {string} request.input - Serialized  messages payload.
 * @param {number} [request.studyId] - Study scope when inside a study.
 * @param {number} [request.studySessionId] - Session scope when inside a study.
 * @param {number} [request.studyStepId] - Step scope when inside a study.
 * @param {number} [request.documentId] - Document id.
 * @returns {Promise<{ allowed: boolean, logId?: number, reason?: string }>}
 */
async function beginRequest(service, request) {
    const { userId, aiModelId, requestId, input, studyId, studySessionId, studyStepId, documentId } = request || {};

    if (await _hasInflight(service, userId, studySessionId)) {
        return { allowed: false, reason: "You already have a pending AI request in this session" };
    }

    const modelBlocker = await _findBlockingModelCap(service, aiModelId);
    if (modelBlocker) return { allowed: false, reason: modelBlocker };

    const shareBlocker = await _findBlockingShareCap(service, { userId, aiModelId, studyId });
    if (shareBlocker) return { allowed: false, reason: shareBlocker };

    const log = await service.server.db.models["ai_log"].create({
        userId,
        aiModelId,
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
 * Record a successful response: persist already-parsed outcome, flip status,
 * notify if needed. 
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id.
 * @param {Object} outcome - Pre-parsed fields ready for ai_log persistence.
 * @param {string} [outcome.output] - Serialized provider choices (JSON string).
 * @param {string} [outcome.reasoning] - Reasoning trace, 
 * @param {number} [outcome.inputTokens] - input tokens consumed.
 * @param {number} [outcome.outputTokens] - Completion tokens generated.
 * @param {number} [outcome.totalTokens] - Total tokens (prompt + completion).
 * @param {number} [outcome.costs] - Cost in dollars, already numeric or null.
 * @returns {Promise<void>}
 */
async function completeRequest(service, logId, outcome) {
    await service.server.db.models["ai_log"].update({
        ...outcome,
        status: "completed",
    }, { where: { id: logId } });

    _notifyIfThreshold(service, logId).catch((err) =>
        service.logger.error(`Notify check failed: ${err.message}`)
    );
}

/**
 * Record a failed response: flip status to 'failed', store error message.
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id returned from beginRequest.
 * @param {string} [errorMessage] - Human-readable error message to store on the log.
 * @returns {Promise<void>}
 */
async function failRequest(service, logId, errorMessage) {
    await service.server.db.models["ai_log"].update({
        status: "failed",
        output: errorMessage || "Unknown error",
    }, { where: { id: logId } });
}

/**
 * Cancel the user's in-flight request in this session: after you abort at LiteLLM, flip status.
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id that we need to cancell.
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
 * Reset a share's per-user cap window (sets resetAt = NOW on the share row).
 *
 * @param {Object} service - AIService instance.
 * @param {Object} request - Reset target.
 * @param {number} request.shareId - ai_model_share.id to reset.
 * @returns {Promise<void>}
 */
async function resetShareBudget(service, request) {
    const shareId = Number(request?.shareId);
    await service.server.db.models["ai_model_share"].update(
        { resetAt: new Date() },
        { where: { id: shareId } }
    );
}

/**
 * Reset a model's global cap window (sets resetAt = NOW on the model row).
 *
 * @param {Object} service - AIService instance.
 * @param {Object} request - Reset target.
 * @param {number} request.modelId - ai_model.id to reset.
 * @returns {Promise<void>}
 */
async function resetModelBudget(service, request) {
    const modelId = Number(request?.modelId);
    await service.server.db.models["ai_model"].update(
        { resetAt: new Date() },
        { where: { id: modelId } }
    );
}

/// Internal helpers

/**
 * True if the user already has an in-flight request in this session.
 *
 * @param {Object} service - AIService instance.
 * @param {number} userId - Authenticated user.
 * @param {number} [studySessionId] - Session scope; null means outside-session scope.
 * @returns {Promise<boolean>}
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
 * Returns a reason if the model's global cap is exhausted, else null.
 *
 * @param {Object} service - AIService instance.
 * @param {number} aiModelId - Model to evaluate.
 * @returns {Promise<string|null>}
 */
async function _findBlockingModelCap(service, aiModelId) {
    const model = await service.server.db.models["ai_model"].findByPk(aiModelId);
    if (!model || model.costLimit === null) return null;

    const used = await _sumCostForModel(service, model);
    if (used >= model.costLimit) {
        return `Model budget exhausted: $${used.toFixed(2)} / $${model.costLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Returns a reason if the per-user share cap is exhausted, else null.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} scope - Subset of the request envelope used for share lookup.
 * @param {number} scope.userId - Authenticated user triggering the request.
 * @param {number} scope.aiModelId - Model the request targets.
 * @param {number} [scope.studyId] - Study scope when inside a study.
 * @returns {Promise<string|null>}
 */
async function _findBlockingShareCap(service, scope) {
    const share = await _getApplicableShare(service, scope);
    if (!share || share.costLimit === null) return null;

    const used = await _sumCostForShare(service, share, scope.userId);
    if (used >= share.costLimit) {
        return `Budget exceeded: $${used.toFixed(2)} / $${share.costLimit.toFixed(2)}`;
    }
    return null;
}

/**
 * Find the share row governing this request (study-scoped if in a study).
 *
 * @param {Object} service - AIService instance.
 * @param {Object} scope - Subset of the request envelope used for share lookup.
 * @param {number} scope.userId - Authenticated user triggering the request.
 * @param {number} scope.aiModelId - Model the request targets.
 * @param {number} [scope.studyId] - Study scope when inside a study workflow.
 * @returns {Promise<Object|null>}
 */
async function _getApplicableShare(service, { userId, aiModelId, studyId }) {
    const where = {
        aiModelId,
        enabled: true,
        deleted: false,
    };

    if (studyId) {
        where.studyId = studyId;
    } else {
        where.studyId = null;
        where.userId = userId;
    }

    return service.server.db.models["ai_model_share"].findOne({ where });
}

/**
 * Sum ai_log.costs for the whole model (all users), respecting model.resetAt.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} model - ai_model row whose usage we are summing.
 * @param {number} model.id - Primary key of the model.
 * @param {Date} [model.resetAt] - Timestamp; only logs at or after this count.
 * @returns {Promise<number>}
 */
async function _sumCostForModel(service, model) {
    const Sequelize = service.server.db.Sequelize;
    const where = {
        aiModelId: model.id,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
    };
    if (model.resetAt) where.createdAt = { [Op.gte]: model.resetAt };

    const result = await service.server.db.models["ai_log"].findOne({
        where,
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

/**
 * Sum ai_log.costs for one user against a share's scope, respecting share.resetAt.
 *
 * @param {Object} service - AIService instance.
 * @param {Object} share - ai_model_share row defining the cap scope.
 * @param {number} share.aiModelId - Model this share governs.
 * @param {number} [share.studyId] - Study scope; null means outside-study scope.
 * @param {Date} [share.resetAt] - Timestamp; only logs at or after this count.
 * @param {number} requestUserId - The user whose spend we are summing.
 * @returns {Promise<number>}
 */
async function _sumCostForShare(service, share, requestUserId) {
    const Sequelize = service.server.db.Sequelize;
    const where = {
        aiModelId: share.aiModelId,
        deleted: false,
        status: { [Op.in]: ["completed", "in_progress"] },
        userId: requestUserId,
    };
    if (share.resetAt) where.createdAt = { [Op.gte]: share.resetAt };

    const include = share.studyId ? [{
        model: service.server.db.models["study_session"],
        where: { studyId: share.studyId },
        required: true,
        attributes: [],
    }] : [];

    const result = await service.server.db.models["ai_log"].findOne({
        where,
        include,
        attributes: [[Sequelize.fn("SUM", Sequelize.col("costs")), "total"]],
        raw: true,
    });
    return parseFloat(result?.total || 0);
}

/**
 * Email cap owner if usage crosses notifyThreshold (stub for v1).
 *
 * @param {Object} service - AIService instance.
 * @param {number} logId - ai_log.id whose context we evaluate.
 * @returns {Promise<void>}
 */
async function _notifyIfThreshold(service, logId) {
    // pending.
}

module.exports = {
    beginRequest,
    completeRequest,
    failRequest,
    cancelRequest,
    resetShareBudget,
    resetModelBudget,
};

