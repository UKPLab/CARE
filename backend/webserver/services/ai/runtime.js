"use strict";

/**
 * Lightweight glue reachable from AIService orchestration helpers for RPC retrieval and auditing.
 *
 * @module webserver/services/ai/runtime
 * @author Akash Gundapuneni
 */

/**
 * Resolves the registered LiteLLM RPC bridge on the webserver instance.
 *
 * @param {{ rpcs: Object }} server Bootstrapped CARE webserver.
 * @returns {Object|null}
 */
function getRPC(server) {
    return server.rpcs.LiteLLMRPC || null;
}

/**
 * Persists a single `ai_log` row swallowing serialization errors — chat flows must remain resilient.
 *
 * @param {{ logger: Object, server: Object }} service AIService (or compatible) shim.
 * @param {Object} logData Sequelize-friendly column/value bag matching `ai_log` columns.
 */
async function logAiCall(service, logData) {
    try {
        await service.server.db.models.ai_log.add({
            userId: logData.userId,
            aiModelId: logData.aiModelId || null,
            requestId: logData.requestId || null,
            input: logData.input || null,
            output: logData.output || null,
            reasoning: logData.reasoning || null,
            inputTokens: logData.inputTokens ?? null,
            outputTokens: logData.outputTokens ?? null,
            totalTokens: logData.totalTokens ?? null,
            costs: logData.costs ?? null,
            status: logData.status || null,
            requestStart: logData.requestStart || null,
        });
    } catch (error) {
        service.logger.warn("Failed to write ai_log entry: " + error.message);
    }
}

/**
 * Derives FK linkage via explicit ids or by reverse lookup on user-owned `model` strings.
 *
 * @param {{ db: Object }} server DB accessor housing Sequelize models registry.
 * @param {number|undefined|null} userId Owner filter for heuristic resolution.
 * @param {{ aiModelId?: number, model?: string }} data Chat payload remnants.
 * @returns {Promise<number|null>} Matching `ai_model.id` else null.
 */
async function resolveAiModelId(server, userId, data = {}) {
    const explicitId = Number(data?.aiModelId);
    if (Number.isInteger(explicitId) && explicitId > 0) {
        return explicitId;
    }

    const modelCandidates = [];
    const rawModel = typeof data?.model === "string" ? data.model.trim() : "";
    if (rawModel) modelCandidates.push(rawModel);
    if (rawModel.includes("/")) {
        const modelWithoutProvider = rawModel.slice(rawModel.indexOf("/") + 1);
        if (modelWithoutProvider && !modelCandidates.includes(modelWithoutProvider)) {
            modelCandidates.push(modelWithoutProvider);
        }
    }
    if (modelCandidates.length === 0) {
        return null;
    }

    const where = {
        userId,
        deleted: false,
        model: modelCandidates,
    };

    const aiModel = await server.db.models.ai_model.findOne({
        where,
        order: [["updatedAt", "DESC"]],
        raw: true,
    });
    return aiModel?.id || null;
}

module.exports = {
    getRPC,
    logAiCall,
    resolveAiModelId,
};
