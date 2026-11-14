"use strict";

/**
 * Lightweight glue reachable from AIService orchestration helpers for RPC retrieval.
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
 * Derives FK linkage via explicit ids or by reverse lookup on user-owned `model` strings.
 *
 * @param {{ db: Object }} server DB accessor housing Sequelize models registry.
 * @param {number|undefined|null} userId Owner filter for heuristic resolution.
 * @param {{ aiModelId?: number, aiCredentialId?: number, credentialId?: number, model?: string }} data Chat payload remnants.
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
    const credentialId = Number(data?.aiCredentialId || data?.credentialId);
    if (Number.isInteger(credentialId) && credentialId > 0) {
        where.aiCredentialId = credentialId;
    }

    const aiModel = await server.db.models.ai_model.findOne({
        where,
        order: [["updatedAt", "DESC"]],
        raw: true,
    });
    return aiModel?.id || null;
}

module.exports = {
    getRPC,
    resolveAiModelId,
};
