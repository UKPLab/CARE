"use strict";

const {randomUUID} = require("crypto");
const h = require("./helpers");
const rt = require("./runtime");

function parseNumericCost(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

async function chatCompletion(service, client, data) {
    const rpc = rt.getRPC(service.server);
    if (!rpc) {
        service.logger.error("LiteLLM RPC is not registered");
        throw new Error("LiteLLM service is not available");
    }
    if (!(await rpc.isOnline())) {
        service.logger.error("LiteLLM RPC is not connected");
        throw new Error("LiteLLM service is not connected");
    }

    const requestStart = new Date();
    const aiModelId = await rt.resolveAiModelId(service.server, client?.userId, data);
    const requestId = typeof data?.__requestId === "string" && data.__requestId.trim()
        ? data.__requestId.trim()
        : randomUUID();

    let response;
    try {
        response = await rpc.chatCompletion({
            ...(data || {}),
            __requestId: requestId,
        });
    } catch (err) {
        await rt.logAiCall(service, {
            userId: client?.userId,
            aiModelId,
            requestId,
            input: h.extractInputText(data?.messages),
            status: "failed",
            requestStart,
        });
        throw err;
    }
    const payload = response.data !== undefined ? response.data : response;

    const {choices = [], usage, model, id} = payload || {};
    const finishReasons = choices.map((c) => c.finish_reason).filter(Boolean);
    service.logger.info(
        `chatCompletion: id=${id} model=${model} ` +
        `tokens=${usage ? usage.total_tokens : "N/A"} ` +
        `finish=${finishReasons.join(",") || "N/A"}`
    );

    await rt.logAiCall(service, {
        userId: client?.userId,
        aiModelId,
        requestId,
        input: h.extractInputText(data?.messages),
        output: JSON.stringify(choices),
        reasoning: payload?.reasoning_content || null,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        costs: parseNumericCost(payload?.response_cost),
        status: "success",
        requestStart,
    });

    return {choices};
}

async function abortChatCompletion(service, data) {
    const rpc = rt.getRPC(service.server);
    if (!rpc || !(await rpc.isOnline())) {
        return {aborted: false, message: "LiteLLM service is not connected"};
    }

    return rpc.abortChatCompletion(data && data.requestId, data && data.reason);
}

async function getStatus(service) {
    const rpc = rt.getRPC(service.server);
    if (!rpc) {
        return {online: false, error: "LiteLLM RPC not registered"};
    }
    try {
        return await rpc.getStatus();
    } catch (err) {
        service.logger.error("Failed to get LLM status: " + err.message);
        return {online: false, error: err.message};
    }
}

async function getValidModels(service, client, data) {
    const rpc = rt.getRPC(service.server);
    if (!rpc) {
        throw new Error("LiteLLM service is not available");
    }
    if (!(await rpc.isOnline())) {
        throw new Error("LiteLLM service is not connected");
    }

    const credentialId = Number(data?.credentialId);
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
        throw new Error("Missing or invalid credentialId");
    }

    const credential = await service.server.db.models.ai_credential.getById(credentialId, {
        attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
    });
    if (!credential || credential.deleted) {
        throw new Error("Credential not found");
    }
    if (!client?.userId || credential.userId !== client.userId) {
        throw new Error("You are not allowed to access this credential");
    }
    if (!credential.enabled) {
        throw new Error("Credential is disabled");
    }
    const provider = typeof credential.provider === "string" ? credential.provider.trim().toLowerCase() : "";
    if (!provider) {
        throw new Error("Credential provider is required to load models");
    }

    return rpc.getValidModels({
        provider,
        apiKey: credential.apiKey,
        apiBaseUrl: credential.apiBaseUrl || null,
        apiVersion: credential.apiVersion || null,
    });
}

async function testModel(service, client, data) {
    const rpc = rt.getRPC(service.server);
    if (!rpc) {
        throw new Error("LiteLLM service is not available");
    }
    if (!(await rpc.isOnline())) {
        throw new Error("LiteLLM service is not connected");
    }

    const credentialId = Number(data?.credentialId);
    const model = typeof data?.model === "string" ? data.model.trim() : "";
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
        throw new Error("Missing or invalid credentialId");
    }
    if (!model) {
        throw new Error("Missing model");
    }

    const credential = await service.server.db.models.ai_credential.getById(credentialId, {
        attributes: ["id", "userId", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
    });
    if (!credential || credential.deleted) {
        throw new Error("Credential not found");
    }
    if (!client?.userId || credential.userId !== client.userId) {
        throw new Error("You are not allowed to access this credential");
    }
    if (!credential.enabled) {
        throw new Error("Credential is disabled");
    }

    const params = {
        model,
        messages: [{role: "user", content: "ping"}],
        max_tokens: 16,
        api_key: credential.apiKey,
    };
    if (credential.apiBaseUrl) {
        params.api_base = credential.apiBaseUrl;
    }
    if (credential.apiVersion) {
        params.api_version = credential.apiVersion;
    }
    if (
        data?.additionalParameters &&
        typeof data.additionalParameters === "object" &&
        !Array.isArray(data.additionalParameters)
    ) {
        const reservedKeys = new Set([
            "model",
            "messages",
            "api_key",
            "api_base",
            "api_version",
            "max_tokens",
        ]);
        Object.assign(
            params,
            Object.fromEntries(
                Object.entries(data.additionalParameters).filter(([key]) => !reservedKeys.has(key))
            )
        );
    }

    const requestStart = new Date();
    const aiModelId = await rt.resolveAiModelId(service.server, client?.userId, {
        aiModelId: data?.aiModelId,
        model,
    });

    let response;
    const requestId = randomUUID();
    try {
        response = await rpc.chatCompletion({
            ...params,
            __requestId: requestId,
        });
    } catch (err) {
        await rt.logAiCall(service, {
            userId: client?.userId,
            aiModelId,
            requestId,
            input: h.extractInputText(params.messages),
            status: "failed",
            requestStart,
        });
        throw err;
    }
    const payload = response?.data !== undefined ? response.data : response;
    const content = payload?.choices?.[0]?.message?.content;
    const usage = payload?.usage || {};

    let outputText = "";
    if (typeof content === "string") {
        outputText = content;
    } else if (Array.isArray(content)) {
        outputText = content
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part === "object" && typeof part.text === "string") return part.text;
                return "";
            })
            .filter(Boolean)
            .join("\n");
    } else if (content !== undefined && content !== null) {
        outputText = String(content);
    }

    await rt.logAiCall(service, {
        userId: client?.userId,
        aiModelId,
        requestId,
        input: h.extractInputText(params.messages),
        output: outputText || null,
        reasoning: payload?.reasoning_content || null,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        costs: parseNumericCost(payload?.response_cost),
        status: "success",
        requestStart,
    });

    return {ok: true, outputText};
}

module.exports = {
    chatCompletion,
    abortChatCompletion,
    getStatus,
    getValidModels,
    testModel,
};
