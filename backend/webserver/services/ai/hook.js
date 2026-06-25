"use strict";

/**
 * AIService helpers for executing an AI hook
 *
 * @module webserver/services/ai/hook
 * @author Mohammed Rawhani
 */

const chat = require("./chat");
const { resolveTemplateWithValues } = require("../../../utils/templateResolver");

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
    const hookModel = await service.server.db.models['ai_hook_models'].findOne({
        where: { aiHookId: hookId, deleted: false },
        order: [["priority", "ASC"]],
        raw: true,
    });
    if (!hookModel) {
        throw new Error("AI hook has no configured model");
    }

    const aiModel = await service.server.db.models['ai_model'].getById(hookModel.aiModelId);
    if (!aiModel || aiModel.deleted) {
        throw new Error("AI hook model not found");
    }
    if (!aiModel.enabled) {
        throw new Error("AI hook model is disabled");
    }

    const credential = await service.server.db.models['ai_credential'].getById(aiModel.aiCredentialId, {
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
 * Resolves a single backend-side input reference (mirrors NLP `serviceReplacement`, but yields
 * text/JSON for prompt substitution rather than base64).
 *
 * @param {{ server: Object }} service AIService runtime with DB access.
 * @param {Object} input The reference's `input` spec (carries `type` + ids).
 * @returns {Promise<*>} Resolved value for the placeholder.
 */
async function resolveServiceInput(service, input) {
    if (!input || typeof input !== "object") return null;
    switch (input.type) {
        case "configuration": {
            const config = await service.server.db.models["configuration"].findByPk(input.configurationId, {raw: true});
            if (!config) return null;
            if (typeof config.content === "string") {
                try {
                    return JSON.parse(config.content);
                } catch (e) {
                    return config.content;
                }
            }
            return config.content;
        }
        case "submission": {
            const { selectedFiles = [], pdfText, submissionId, filePatterns = {} } = input;
            if (!submissionId || !selectedFiles.length) return "";

            const parts = [];

            // PDF was extracted in the browser; embed with label.
            if (selectedFiles.includes("pdf") && pdfText != null) {
                parts.push(`pdf:\n${pdfText}`);
            }

            // Zip-based files (tex, bib, …) — unzip on the backend.
            // filePatterns maps logical name → validation-config regex (e.g. "expose" → "Expose\\.tex$").
            const zipFileSpecs = selectedFiles
                .filter(f => f !== "pdf")
                .map(name => ({name, pattern: filePatterns[name] || null}));
            if (zipFileSpecs.length) {
                const zipDoc = await service.server.db.models["document"].findOne({
                    where: { submissionId, type: 4, deleted: false },
                    raw: true,
                });
                if (zipDoc) {
                    const buffer = await service.server.db.models["document"]
                        .readDocumentFile(zipDoc, ".zip");
                    if (buffer) {
                        const extracted = await service.server.db.models["document"]
                            .extractZipFiles(buffer, zipFileSpecs);
                        for (const [fileName, content] of Object.entries(extracted)) {
                            parts.push(`${fileName}:\n${content}`);
                        }
                    }
                }
            }

            return parts.join("\n\n");
        }
        default:
            return null;
    }
}

/**
 * Resolves any backend-side references in the pushed values map (configuration, submission),
 * leaving frontend-resolved values (document text, study data) as-is.
 *
 * @param {{ server: Object }} service AIService runtime with DB access.
 * @param {Object} values Map of placeholderKey → value or `{type:"serviceReplacement", input}`.
 * @returns {Promise<Object>} Map with references resolved to values.
 */
async function resolveHookReferences(service, values) {
    const resolved = {};
    for (const [key, value] of Object.entries(values || {})) {
        if (value && typeof value === "object" && value.type === "serviceReplacement") {
            resolved[key] = await resolveServiceInput(service, value.input);
        } else {
            resolved[key] = value;
        }
    }
    return resolved;
}

/**
 * Executes an AI hook for the calling client: fills the hook's prompt template from the
 * caller-supplied placeholder `values` (assembled in the frontend from the input mapping),
 * attaches the hook's primary model credential, and forwards through the shared chat path.
 *
 * @param {{ logger: Object, server: Object }} service AIService runtime.
 * @param {{ userId?: number }} client Authenticated RPC client triggering the hook.
 * @param {{ hookId: number, values?: Object, studyId?: number, studySessionId?: number, studyStepId?: number, documentId?: number }} data Hook execution payload.
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
    const rawValues = (data?.values && typeof data.values === "object") ? data.values : {};
    const values = await resolveHookReferences(service, rawValues);
    const promptText = await resolveTemplateWithValues(hook.templateId, values, service.server.db.models);
    
    const { additionalParameters, ...credentialParams } = modelParams;
    const completionData = {
        ...additionalParameters,
        ...credentialParams,
        aiHookId: hookId,
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
