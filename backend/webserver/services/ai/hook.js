"use strict";

/**
 * AIService helpers for executing an AI hook
 *
 * @module webserver/services/ai/hook
 */

const chat = require("./chat");
const { resolveTemplateToDelta } = require("../../../utils/templateResolver");
const { deltaToPlainText } = require("editor-delta-conversion");

/**
 * Context keys that {@link resolveTemplateToDelta} consumes and bind with.
 *
 * @type {string[]}
 */
const HOOK_BINDABLE_CONTEXT_KEYS = ["documentId", "studyStepId", "studySessionId", "studyId", "pdfText", "language"];

/**
 * Loads an enabled, non-deleted AI hook by id.
 *
 * @param {{ server: Object }} service AIService runtime with DB access.
 * @param {number} hookId Target `ai_hook` primary key.
 * @returns {Promise<Object>} The hook row.
 * @throws {Error} If the hook is missing, deleted, or disabled.
 */
async function loadEnabledHook(service, hookId) {
    const hook = await service.server.db.models.ai_hook.getById(hookId);
    if (!hook || hook.deleted) {
        throw new Error("AI hook not found");
    }
    if (!hook.enabled) {
        throw new Error("AI hook is disabled");
    }
    if (!hook.templateId) {
        throw new Error("AI hook has no prompt template");
    }
    return hook;
}

/**
 * Resolves the hook's primary model (priority 1) into the model string plus the owner's
 * credential parameters required by the LiteLLM passthrough.
 *
 * @param {{ server: Object }} service AIService runtime with DB access.
 * @param {number} hookId Target `ai_hook` primary key.
 * @returns {Promise<{aiModelId: number, aiCredentialId: number, model: string, api_key: string, api_base?: string, api_version?: string, additionalParameters: Object}>}
 * @throws {Error} If no usable model/credential is configured for the hook.
 */
async function resolveHookModelParams(service, hookId) {
    const hookModel = await service.server.db.models.ai_hook_models.findOne({
        where: { aiHookId: hookId, deleted: false },
        order: [["priority", "ASC"]],
        raw: true,
    });
    if (!hookModel) {
        throw new Error("AI hook has no configured model");
    }

    const aiModel = await service.server.db.models.ai_model.getById(hookModel.aiModelId);
    if (!aiModel || aiModel.deleted) {
        throw new Error("AI hook model not found");
    }
    if (!aiModel.enabled) {
        throw new Error("AI hook model is disabled");
    }

    const credential = await service.server.db.models.ai_credential.getById(aiModel.aiCredentialId, {
        attributes: ["id", "userId", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
    });
    if (!credential || credential.deleted) {
        throw new Error("AI hook model credential not found");
    }
    if (!credential.enabled) {
        throw new Error("AI hook model credential is disabled");
    }

    const params = {
        aiModelId: aiModel.id,
        aiCredentialId: credential.id,
        model: aiModel.model,
        api_key: credential.apiKey,
        additionalParameters: hookModel.additionalParameters || {},
    };
    if (credential.apiBaseUrl) {
        params.api_base = credential.apiBaseUrl;
    }
    if (credential.apiVersion) {
        params.api_version = credential.apiVersion;
    }
    return params;
}

/**
 * Builds the template-resolution context parameters from the runtime study-step data, 
 *
 * @param {{ studyId?: number, studySessionId?: number, studyStepId?: number, documentId?: number, inputs?: Object }} data Hook execution payload containing context info plus optional input specs.
 * @returns {Object} Context object accepted by {@link resolveTemplateToDelta}.
 */
function buildHookContext(data) {
    const context = {
        studyId: data?.studyId,
        studySessionId: data?.studySessionId,
        studyStepId: data?.studyStepId,
        documentId: data?.documentId,
    };

    const inputs = data?.inputs;
    if (inputs && typeof inputs === "object") {
        for (const spec of Object.values(inputs)) {
            if (!spec || typeof spec !== "object") {
                continue;
            }
            for (const key of HOOK_BINDABLE_CONTEXT_KEYS) {
                if (spec[key] !== undefined && spec[key] !== null) {
                    context[key] = spec[key];
                }
            }
        }
    }
    return context;
}

/**
 * Resolves the hook's prompt template to clean plain text suitable for an LLM message.
 * Uses the Delta variant (not the HTML one) so placeholder values are not HTML-escaped.
 *
 * @param {{ server: Object }} service AIService runtime with DB access.
 * @param {number} templateId Prompt template id referenced by the hook.
 * @param {Object} context Context object for placeholder resolution.
 * @returns {Promise<string>} Resolved prompt text.
 */
async function buildHookPrompt(service, templateId, context) {
    const delta = await resolveTemplateToDelta(templateId, context, service.server.db.models);
    return deltaToPlainText({ ops: delta?.ops || [] });
}

/**
 * Executes an AI hook for the calling client: resolves the prompt template against study-step
 * context, attaches the hook's primary model credential, and forwards through the shared chat path.
 *
 * @param {{ logger: Object, server: Object }} service AIService runtime.
 * @param {{ userId?: number }} client Authenticated RPC client triggering the hook.
 * @param {{ hookId: number, inputs?: Object, studyId?: number, studySessionId?: number, studyStepId?: number, documentId?: number }} data Hook execution payload.
 * @returns {Promise<{choices: unknown[], outputText: string}>} Provider choices plus first-choice text.
 * @throws {Error} If the hook id is invalid or any required model/credential/template is missing.
 */
async function runHook(service, client, data) {
    const hookId = Number(data?.hookId);
    if (!Number.isInteger(hookId) || hookId <= 0) {
        throw new Error("Missing or invalid hookId");
    }

    const hook = await loadEnabledHook(service, hookId);
    const modelParams = await resolveHookModelParams(service, hookId);
    const context = buildHookContext(data);
    const promptText = await buildHookPrompt(service, hook.templateId, context);

    const { additionalParameters, ...credentialParams } = modelParams;
    const completionData = {
        ...additionalParameters,
        ...credentialParams,
        messages: [{ role: "user", content: promptText }],
        outputMode: hook.outputMode,
        studyId: data?.studyId,
        studySessionId: data?.studySessionId,
        studyStepId: data?.studyStepId,
        documentId: data?.documentId,
    };

    service.logger.info(
        `runHook: hookId=${hookId} templateId=${hook.templateId} ` +
        `aiModelId=${modelParams.aiModelId} studyStepId=${data?.studyStepId ?? "N/A"}`
    );

    const result = await chat.chatCompletion(service, client, completionData);
    const content = result.choices?.[0]?.message?.content;
    const outputText = typeof content === "string" ? content : "";

    return { choices: result.choices, outputText };
}

module.exports = {
    runHook,
};
