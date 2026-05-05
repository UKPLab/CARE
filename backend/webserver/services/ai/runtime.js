"use strict";

const h = require("./helpers");

function getRPC(server) {
    return server.rpcs.LiteLLMRPC || null;
}

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
    } catch (err) {
        service.logger.warn("Failed to write ai_log entry: " + err.message);
    }
}

async function resolveAiModelId(server, userId, data = {}) {
    const explicitId = Number(data?.aiModelId);
    if (Number.isInteger(explicitId) && explicitId > 0) {
        return explicitId;
    }

    const modelCandidates = [];
    const rawModel = typeof data?.model === "string" ? data.model.trim() : "";
    const resolvedModel = rawModel;
    if (rawModel) modelCandidates.push(rawModel);
    if (resolvedModel && resolvedModel !== rawModel) modelCandidates.push(resolvedModel);
    if (resolvedModel.includes("/")) {
        const modelWithoutProvider = resolvedModel.slice(resolvedModel.indexOf("/") + 1);
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
