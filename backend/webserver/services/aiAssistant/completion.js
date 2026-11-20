"use strict";

/**
 * Model calls made by the AI assistant.
 *
 * The assistant uses the selected hook model (or the first one) without fallback and
 * shows errors to the student, so it calls the shared AI pieces directly instead of `runHook`.
 *
 * @module webserver/services/aiAssistant/completion
 * @author Mohammed Rawhani
 */

const helpers = require("../../../utils/helper/ai/helpers.js");
const core = require("./core.js");

/**
 * Sends a message history to the model and returns the answer text.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Validated assistant context.
 * @param {Object} data - Prepared completion request.
 * @param {Object} data.modelParams - Resolved hook model parameters.
 * @param {string} data.requestId - Logging and abort identifier.
 * @param {Object[]} data.messages - Complete model messages.
 * @param {number|null} [data.aiMessageId=null] - Message linked to the AI log.
 * @param {function(string): void} [onDelta] - Receives streamed answer text.
 * @returns {Promise<string>} Model response content.
 */
async function requestAssistantCompletion(service, client, context, data, onDelta) {
    const {modelParams, requestId, messages, aiMessageId = null} = data;
    const {additionalParameters, aiModelId, hookModelId, ...providerParams} = modelParams;
    delete providerParams.aiCredentialId;
    delete providerParams.contextWindowTokens;

    const result = await core.getAIService(service).call("chatCompletion", client, {
        ...additionalParameters,
        aiModelId,
        aiHookId: context.hookId,
        studyId: context.studySession.studyId,
        studySessionId: context.studySession.id,
        studyStepId: context.studyStep.id,
        documentId: context.studyStep.documentId,
        __requestId: requestId,
        messages,
    }, {
        onDelta,
        log: {
            aiMessageId,
            hookModelId,
            providerParams,
            input: helpers.serializeMessages(messages),
        },
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
}

/**
 * Fills a hook's prompt and sends it to the hook's first model as one user message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Validated assistant context.
 * @param {Object} data - Prepared hook request.
 * @param {number} data.hookId - Hook providing the prompt and model.
 * @param {Object} data.values - Prompt placeholder values.
 * @param {string} data.requestId - Logging and abort identifier.
 * @param {number} data.aiMessageId - Message linked to the AI log.
 * @param {Object} [data.parameters] - Model parameter overrides.
 * @returns {Promise<{output: string, aiModelId: number}>} Model response and used model.
 */
async function requestHookCompletion(service, client, context, data) {
    const {hookId, values, requestId, aiMessageId, parameters = {}} = data;
    const aiService = core.getAIService(service);
    const {promptText} = await aiService.call("resolveHookPrompt", client, {hookId, values});
    const modelParams = await aiService.call("resolveHookModel", client, {hookId});
    const output = await requestAssistantCompletion(
        service,
        client,
        {...context, hookId},
        {
            modelParams: {...modelParams, additionalParameters: {...modelParams.additionalParameters, ...parameters}},
            requestId,
            messages: [{role: "user", content: promptText}],
            aiMessageId,
        },
    );
    return {output, aiModelId: modelParams.aiModelId};
}

module.exports = {
    requestAssistantCompletion,
    requestHookCompletion,
};
