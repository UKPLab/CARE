"use strict";

/**
 * Stateless helpers shared by AI handlers.
 *
 * @module utils/helper/ai/helpers
 * @author Akash Gundapuneni
 */

/**
 * Flattens OpenAI-compatible messages into text while retaining role labels.
 *
 * @param {unknown} messages Serialized chat history.
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
                        if (typeof part === "string") {
                            return part;
                        }
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
 * Builds parameters for a LiteLLM completion call.
 *
 * @param {Object} credential Credential row supplying provider authentication.
 * @param {string} modelName Raw model name.
 * @returns {Object} LiteLLM completion parameters.
 */
function buildLiteLLMParams(credential, modelName) {
    const provider = typeof credential.provider === "string"
        ? credential.provider.trim().toLowerCase()
        : "";
    const model = provider && !modelName.startsWith(`${provider}/`)
        ? `${provider}/${modelName}`
        : modelName;
    const params = { model, api_key: credential.apiKey };
    if (provider) {
        params.custom_llm_provider = provider;
    }
    if (credential.apiBaseUrl) {
        params.api_base = credential.apiBaseUrl;
    }
    if (credential.apiVersion) {
        params.api_version = credential.apiVersion;
    }
    return params;
}

module.exports = {
    extractInputText,
    buildLiteLLMParams,
};
