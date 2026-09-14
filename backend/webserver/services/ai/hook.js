"use strict";

/**
 * AIService helpers for executing an AI hook
 *
 * @module webserver/services/ai/hook
 * @author Mohammed Rawhani
 */

const chat = require("./chat");
const TranslatableError = require("../../../utils/TranslatableError");
const helpers = require("../../../utils/helper/ai/helpers.js");
const { resolveTemplateWithValues } = require("../../../utils/helper/templateResolver");

/**
 * Loads an enabled, non-deleted AI hook by id.
 *
 * @param {Object} service - AIService runtime with DB access.
 * @param {Object} service.server - CARE webserver instance (DB access).
 * @param {number} hookId - Target `ai_hook` primary key.
 * @returns {Promise<Object>} The hook row.
 * @throws {Error} If the hook is missing, deleted, or disabled.
 */
async function loadEnabledHook(service, hookId) {
    const hook = await service.server.db.models.ai_hook.getById(hookId);
    if (!hook || hook.deleted) {
        throw new TranslatableError("errors.ai.hook.notFound");
    }
    if (!hook.enabled) {
        throw new TranslatableError("errors.ai.hook.disabled");
    }
    if (!hook.templateId) {
        throw new TranslatableError("errors.ai.hook.templateRequired");
    }
    return hook;
}

/**
 * Loads a hook's models in runtime fallback order.
 *
 * @param {Object} service - AIService runtime with DB access.
 * @param {number} hookId - Target `ai_hook` primary key.
 * @returns {Promise<Object[]>} Active hook-model rows, priority 1 first.
 */
async function loadHookModels(service, hookId) {
    const hookModels = await service.server.db.models["ai_hook_models"].findAll({
        where: {aiHookId: hookId, deleted: false},
        order: [["priority", "ASC"]],
        raw: true,
    });
    if (!hookModels.length) {
        throw new TranslatableError("errors.ai.hook.modelRequired");
    }
    return hookModels;
}

/**
 * Resolves one hook-model row into LiteLLM provider parameters.
 *
 * @param {Object} service - AIService runtime with DB access.
 * @param {Object} hookModel - One ordered `ai_hook_models` row.
 * @returns {Promise<Object>} Model id, row parameters, and credential parameters.
 */
async function resolveHookModelParams(service, hookModel) {
    const aiModel = await service.server.db.models["ai_model"].getById(hookModel.aiModelId);
    if (!aiModel || aiModel.deleted) {
        throw new TranslatableError("errors.ai.hook.modelNotFound");
    }
    if (!aiModel.enabled) {
        throw new TranslatableError("errors.ai.hook.modelDisabled");
    }

    const credential = await service.server.db.models["ai_credential"].getById(aiModel.aiCredentialId, {
        attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
    });
    if (!credential || credential.deleted) {
        throw new TranslatableError("errors.ai.hook.credentialNotFound");
    }
    if (!credential.enabled) {
        throw new TranslatableError("errors.ai.hook.credentialDisabled");
    }

    return {
        aiModelId: aiModel.id,
        aiCredentialId: credential.id,
        additionalParameters: hookModel.additionalParameters || {},
        ...helpers.buildLiteLLMParams(credential, aiModel.model),
    };
}

/**
 * Resolves a single backend-side input reference (mirrors NLP `serviceReplacement`, but yields
 * text/JSON for prompt substitution rather than base64).
 *
 * @param {Object} service - AIService runtime with DB access.
 * @param {Object} service.server - CARE webserver instance (DB access).
 * @param {Object} input - The reference's `input` spec (carries `type` + ids).
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

            if (selectedFiles.includes("pdf")) {
                let text = pdfText;
                if (!text) {
                    const pdfDoc = await service.server.db.models["document"].findOne({
                        where: {submissionId, type: 0, deleted: false},
                        raw: true,
                    });
                    const buffer = pdfDoc && await service.server.db.models["document"]
                        .readDocumentFile(pdfDoc, ".pdf");
                    if (buffer) {
                        const pdfRpc = service.server.rpcs["PDFRPC"];
                        await pdfRpc.wait(500, pdfRpc.timeout);
                        const extracted = await pdfRpc.getAnnotations({file: buffer});
                        text = extracted.wholeText;
                    }
                }
                if (text) parts.push(text);
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
                        for (const content of Object.values(extracted)) {
                            parts.push(content);
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
 * @param {Object} service - AIService runtime with DB access.
 * @param {Object} service.server - CARE webserver instance (DB access).
 * @param {Object} values - Map of placeholderKey → value or `{type:"serviceReplacement", input}`.
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

/** Empty AI result so study sessions continue when hook/model/credential is unavailable. */
const NULL_HOOK_OUTPUT = Object.freeze({ choices: [], output: null });

/**
 * Executes an AI hook for the calling client: fills the hook's prompt template from the
 * caller-supplied placeholder `values` (assembled in the frontend from the input mapping),
 * then tries its configured models in ascending priority order.
 *
 * For study sessions (studySessionId/studyStepId present), missing/disabled hook, model, or
 * credential soft-skips with `{ choices: [], output: null }`. Triggers and other callers still fail hard.
 *
 * @param {Object} service - AIService runtime.
 * @param {Object} client - Authenticated RPC client triggering the hook.
 * @param {Object} data - Hook execution payload (hookId, values, studySessionId, studyStepId, documentId).
 * @returns {Promise<{choices: unknown[], output: string|null}>} Provider choices plus first-choice content (text or JSON string), or null on study soft-skip.
 * @throws {Error} If the hook id is invalid, or (for non-study callers) hook/model/credential is unavailable.
 */
async function runHook(service, client, data) {
    const hookId = Number(data?.hookId);
    if (!Number.isInteger(hookId) || hookId <= 0) {
        throw new TranslatableError("errors.ai.hook.invalidId");
    }

    try {
        const hook = await loadEnabledHook(service, hookId);
        const hookModels = await loadHookModels(service, hookId);
        const rawValues = (data?.values && typeof data.values === "object") ? data.values : {};
        const values = await resolveHookReferences(service, rawValues);
        const promptText = await resolveTemplateWithValues(hook.templateId, values, service.server.db.models);

        let lastError;
        for (const [index, hookModel] of hookModels.entries()) {
            try {
                const modelParams = await resolveHookModelParams(service, hookModel);
                const {additionalParameters, aiModelId, ...providerParams} = modelParams;
                delete providerParams.aiCredentialId;

                service.logger.info(
                    `runHook: hookId=${hookId} templateId=${hook.templateId} ` +
                    `aiModelId=${aiModelId} priority=${hookModel.priority} ` +
                    `studyStepId=${data?.studyStepId ?? "N/A"}`
                );

                const result = await chat.chatCompletion(service, client, {
                    ...additionalParameters,
                    aiModelId,
                    aiHookId: hookId,
                    messages: [{role: "user", content: promptText}],
                    outputMode: hook.outputMode,
                    studySessionId: data?.studySessionId,
                    studyStepId: data?.studyStepId,
                    documentId: data?.documentId,
                }, {
                    providerParams,
                    hookModelId: hookModel.id,
                });
                const content = result.choices?.[0]?.message?.content;
                const output = typeof content === "string" ? content : "";

                return {choices: result.choices, output};
            } catch (error) {
                lastError = error;
                const hasFallback = index < hookModels.length - 1;
                if (!hasFallback || !isFallbackError(error)) {
                    throw error;
                }
                service.logger.warn(
                    `runHook fallback: hookId=${hookId} aiModelId=${hookModel.aiModelId} ` +
                    `priority=${hookModel.priority} error=${error.message || error}`
                );
            }
        }
        throw lastError;
    } catch (error) {
        // Study only: deleted/disabled AI stack must not block the session.
        const isStudyCall = Number(data?.studySessionId) > 0 || Number(data?.studyStepId) > 0;
        if (isStudyCall) {
            service.logger.warn(
                `runHook soft-skip hookId=${hookId}: ${error.message || error}`
            );
            return NULL_HOOK_OUTPUT;
        }
        throw error;
    }
}

/**
 * Provider errors and unavailable bound models may use the next configured model.
 * Access, session, and budget errors are TranslatableErrors and must stop the hook.
 *
 * @param {Error} error - Failure from model resolution or chat execution.
 * @returns {boolean} Whether the next priority may be attempted.
 */
function isFallbackError(error) {
    if (!TranslatableError.is(error)) {
        return true;
    }
    return [
        "errors.ai.model.notAvailable",
        "errors.budget.modelExhausted",
        "errors.ai.hook.modelNotFound",
        "errors.ai.hook.modelDisabled",
        "errors.ai.hook.credentialNotFound",
        "errors.ai.hook.credentialDisabled",
    ].includes(error.key);
}

module.exports = {
    runHook,
};
