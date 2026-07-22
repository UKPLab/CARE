"use strict";

/**
 * AIService helpers for forwarding chat and model-validation traffic to LiteLLM via RPC,
 * enforcing credential ownership, and recording `ai_log` rows via the budget module.
 *
 * @module webserver/services/ai/chat
 * @author Akash Gundapuneni, Mohamed Rawhani
 */

const {randomUUID} = require("crypto");
const helpers = require("./helpers");
const runtime = require("./runtime");
const budget = require("./budget");

/**
 * Normalizes provider-reported monetary cost fields for persisted logging.
 *
 * @param {unknown} value Raw value from LiteLLM (or provider) payload.
 * @returns {number|null} Parsed finite number, or null if missing or invalid.
 */
function parseNumericCost(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Load an enabled credential owned by `userId` via MetaModel.getById.
 *
 * @param {Object} models DB models map.
 * @param {number} credentialId
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function requireOwnedCredential(models, credentialId, userId) {
    const credential = await models.ai_credential.getById(credentialId, {
        attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled"],
    });
    if (!credential) {
        throw new Error("Credential not found");
    }
    if (!userId || credential.userId !== userId) {
        throw new Error("You are not allowed to access this credential");
    }
    if (!credential.enabled) {
        throw new Error("Credential is disabled");
    }
    return credential;
}

/**
 * Runs an OpenAI-style chat completion for the authenticated client, resolves `ai_model` linkage,
 * persists success/failure to `ai_log`, and returns trimmed choice metadata.
 *
 * @param {{ logger: Object, server: Object }} service AIService runtime with logger and DB access.
 * @param {{ userId?: number }} client Authenticated RPC client (creator of the log row).
 * @param {Object} data Forwarded verbatim to LiteLLM except `__requestId` (optional override).
 * @param {{ bypassChecks?: boolean, testLabel?: string }} [logOptions] `testLabel` is prepended to the
 *   saved `output` so admin test pings stay visible in `ai_log` while still counting toward spend sums.
 * @returns {Promise<{choices: unknown[]}>} Provider choices array subset.
 */
async function chatCompletion(service, client, data, logOptions = {}) {
    const rpc = runtime.getRPC(service.server);
    if (!rpc) {
        service.logger.error("LiteLLM RPC is not registered");
        throw new Error("LiteLLM service is not available");
    }
    if (!(await rpc.isOnline())) {
        service.logger.error("LiteLLM RPC is not connected");
        throw new Error("LiteLLM service is not connected");
    }

    const aiModelId = await runtime.resolveAiModelId(service.server, client?.userId, data);
    const requestId = typeof data?.__requestId === "string" && data.__requestId.trim()
        ? data.__requestId.trim()
        : randomUUID();
    const {
        aiModelId: _aiModelId,
        aiHookId: _aiHookId,
        aiCredentialId: _aiCredentialId,
        credentialId: _credentialId,
        __requestId: _requestId,
        studyId: _studyId,
        studySessionId: _studySessionId,
        studyStepId: _studyStepId,
        documentId: _documentId,
        ...completionParams
    } = data || {};

    const guard = await budget.beginRequest(service, {
        userId: client?.userId,
        aiModelId,
        aiHookId: data?.aiHookId,
        requestId,
        input: helpers.extractInputText(data?.messages),
        studyId: data?.studyId,
        studySessionId: data?.studySessionId,
        studyStepId: data?.studyStepId,
        documentId: data?.documentId,
    }, {
        bypassChecks: !!logOptions.bypassChecks,
    });
    if (!guard.allowed) {
        throw new Error(guard.reason);
    }

    let response;
    try {
        response = await rpc.chatCompletion({
            ...completionParams,
            __requestId: requestId,
        });
    } catch (error) {
        const failureOutput = logOptions.testLabel
            ? `${logOptions.testLabel}\n${error?.message || "Unknown error"}`
            : error?.message;
        await budget.failRequest(service, guard.logId, failureOutput);
        throw error;
    }
    const payload = response.data !== undefined ? response.data : response;

    const {choices = [], usage, model, id} = payload || {};
    const finishReasons = choices.map((choice) => choice.finish_reason).filter(Boolean);
    service.logger.info(
        `chatCompletion: id=${id} model=${model} ` +
        `tokens=${usage ? usage.total_tokens : "N/A"} ` +
        `finish=${finishReasons.join(",") || "N/A"}`
    );

    const outputPayload = JSON.stringify(choices);
    await budget.completeRequest(service, guard.logId, {
        output: logOptions.testLabel ? `${logOptions.testLabel}\n${outputPayload}` : outputPayload,
        reasoning: payload?.reasoning_content || null,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        costs: parseNumericCost(payload?.response_cost),
    });

    return {choices};
}

/**
 * Best-effort abort for an in-flight chat completion identified by provider request id.
 *
 * @param {{ server: Object }} service AIService with RPC registry access.
 * @param {{ requestId?: string, reason?: string }} data Abort payload echoed to LiteLLM.
 * @returns {Promise<{aborted: boolean, message?: string}>}
 */
async function abortChatCompletion(service, data) {
    const rpc = runtime.getRPC(service.server);
    if (!rpc || !(await rpc.isOnline())) {
        return {aborted: false, message: "LiteLLM service is not connected"};
    }

    return rpc.abortChatCompletion(data && data.requestId, data && data.reason);
}

/**
 * Introspects the LiteLLM bridge health for dashboard diagnostics.
 *
 * @param {{ server: Object, logger: Object }} service AIService.
 * @returns {Promise<Object>} RPC `getStatus` payload or `{online:false, error}` envelope.
 */
async function getStatus(service) {
    const rpc = runtime.getRPC(service.server);
    if (!rpc) {
        return {online: false, error: "LiteLLM RPC not registered"};
    }
    try {
        return await rpc.getStatus();
    } catch (error) {
        service.logger.error("Failed to get LLM status: " + error.message);
        return {online: false, error: error.message};
    }
}

/**
 * Lists remote models reachable with the caller-owned credential metadata.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId: number }} client Authenticated user.
 * @param {{ credentialId: number }} data Target credential PK.
 * @returns {Promise<Object>} Same shape returned by LiteLLMRPC `getValidModels`.
 */
async function getValidModels(service, client, data) {
    const rpc = runtime.getRPC(service.server);
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

    const credential = await requireOwnedCredential(
        service.server.db.models,
        credentialId,
        client?.userId,
    );
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

/**
 * Sends a deterministic low-token completion ("ping") to validate wiring for a credential/model pair,
 * merges optional structured `additionalParameters`, and logs parity with production chat completions.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId: number }} client Caller for ownership checks and logging attribution.
 * @param {{ credentialId: number, model: string, aiModelId?: number, additionalParameters?: Object }} data
 * @returns {Promise<{ok:true,outputText:string}>}
 */
async function testModel(service, client, data) {
    const credentialId = Number(data?.credentialId);
    const model = typeof data?.model === "string" ? data.model.trim() : "";
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
        throw new Error("Missing or invalid credentialId");
    }
    if (!model) {
        throw new Error("Missing model");
    }

    const credential = await requireOwnedCredential(
        service.server.db.models,
        credentialId,
        client?.userId,
    );

    const params = {
        ...helpers.buildLiteLLMParams(credential, model),
        messages: [{role: "user", content: "ping"}],
        max_tokens: 16,
    };
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

    const testLabel = `[TEST] model="${model}"${data?.aiModelId ? ` aiModelId=${data.aiModelId}` : ""}`;
    const result = await chatCompletion(service, client, {
        ...params,
        aiModelId: data?.aiModelId,
        aiCredentialId: credentialId,
    }, {
        bypassChecks: true,
        testLabel,
    });

    const content = result.choices?.[0]?.message?.content;
    const outputText = typeof content === "string" ? content : "";

    return {ok: true, outputText};
}

module.exports = {
    chatCompletion,
    abortChatCompletion,
    getStatus,
    getValidModels,
    testModel,
};
