"use strict";

/**
 * Stateless helpers shared by AIService handlers (share UX, normalization, prompts).
 *
 * @module webserver/services/ai/helpers
 * @author Akash Gundapuneni
 */

/**
 * Validates the RPC client's numeric `userId` or throws — share flows require a hardened principal.
 *
 * @param {{ userId?: number }} client Incoming RPC invocation context.
 * @returns {number} Positive finite user id suitable for Sequelize filters.
 */
function requireClientUserId(client) {
    const id = Number(client?.userId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid user context");
    }
    return id;
}

/**
 * Flattens OpenAI-compatible `messages` into a condensed multi-line auditing string while retaining role labels.
 *
 * @param {unknown} messages Serialized chat history from client/RPC payloads.
 * @returns {string|null}
 */
function extractInputText(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return null;
    }
    const text = messages
        .map((message) => {
            const role = typeof message?.role === "string" ? message.role.trim() : "";
            const content = message?.content;
            let normalizedContent = "";
            if (typeof content === "string") {
                normalizedContent = content.trim();
            } else if (Array.isArray(content)) {
                normalizedContent = content
                    .map((part) => {
                        if (typeof part === "string") return part;
                        if (part && typeof part === "object" && typeof part.text === "string") {
                            return part.text;
                        }
                        return "";
                    })
                    .filter(Boolean)
                    .join("\n")
                    .trim();
            } else if (content !== null && content !== undefined) {
                normalizedContent = String(content).trim();
            }
            if (!normalizedContent) {
                return "";
            }
            return role ? `[${role}] ${normalizedContent}` : normalizedContent;
        })
        .filter(Boolean)
        .join("\n\n")
        .trim();

    return text || null;
}

/**
 * Dedupes non-zero integer-ish ids after optional coercion.
 *
 * @param {Iterable<unknown>} values Source iterable.
 * @param {(value: unknown) => number} [pick=(value)=>Number(value)] Mapper applied before filtration.
 * @returns {number[]}
 */
function uniquePositiveInts(values, pick = (x) => Number(x)) {
    return [...new Set((values || []).map(pick).filter((n) => Number.isInteger(n) && n > 0))];
}

/**
 * Builds the params object passed directly to LiteLLM's completion() call from a credential row and a model name.
 *
 * @param {{ provider?: string, apiKey?: string, apiBaseUrl?: string, apiVersion?: string }} credential
 * @param {string} modelName Raw model name as stored in ai_model.model.
 * @returns {{ model: string, api_key: string, custom_llm_provider?: string, api_base?: string, api_version?: string }}
 */
function buildLiteLLMParams(credential, modelName) {
    const provider = typeof credential.provider === "string" ? credential.provider.trim().toLowerCase() : "";
    const model = provider && !modelName.startsWith(provider + "/")
        ? `${provider}/${modelName}`
        : modelName;
    const params = { model, api_key: credential.apiKey };
    if (provider) params.custom_llm_provider = provider;
    if (credential.apiBaseUrl) params.api_base = credential.apiBaseUrl;
    if (credential.apiVersion) params.api_version = credential.apiVersion;
    return params;
}

module.exports = {
    requireClientUserId,
    extractInputText,
    uniquePositiveInts,
    buildLiteLLMParams,
};
