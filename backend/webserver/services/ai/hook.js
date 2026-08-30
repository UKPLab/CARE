"use strict";

/**
 * AIService helpers for executing an AI hook
 *
 * @module webserver/services/ai/hook
 * @author Mohammed Rawhani
 */

const chat = require("./chat");
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
 * @param {Object} service - AIService runtime with DB access.
 * @param {Object} service.server - CARE webserver instance (DB access).
 * @param {number} hookId - Target `ai_hook` primary key.
 * @returns {Promise<Object>} Model string plus the owner's credential params for the LiteLLM passthrough.
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
        attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
    });
    if (!credential || credential.deleted) {
        throw new Error("AI hook model credential not found");
    }
    if (!credential.enabled) {
        throw new Error("AI hook model credential is disabled");
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

            // Keep PDF.js `{ pages, pageCount }` until `applyTextRangeLimit` in the resolver.
            if (selectedFiles.includes("pdf")) {
                return pdfText || "";
            }

            const parts = [];

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
 * attaches the hook's primary model credential, and forwards through the shared chat path.
 *
 * For study sessions (studySessionId/studyStepId present), missing/disabled hook, model, or
 * credential soft-skips with `{ choices: [], output: null }`. Triggers and other callers still fail hard.
 *
 * @param {Object} service - AIService runtime.
 * @param {Object} client - Authenticated RPC client triggering the hook.
 * @param {Object} data - Hook execution payload (hookId, values, studyId, studySessionId, studyStepId, documentId).
 * @returns {Promise<{choices: unknown[], output: string|null}>} Provider choices plus first-choice content (text or JSON string), or null on study soft-skip.
 * @throws {Error} If the hook id is invalid, or (for non-study callers) hook/model/credential is unavailable.
 */
async function runHook(service, client, data) {
    const hookId = Number(data?.hookId);
    if (!Number.isInteger(hookId) || hookId <= 0) {
        throw new Error("Missing or invalid hookId");
    }

    try {
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
        const output = typeof content === "string" ? content : "";

        return { choices: result.choices, output };
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

module.exports = {
    runHook,
};
