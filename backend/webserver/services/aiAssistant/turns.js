"use strict";

/**
 * AI assistant turn persistence and completion lifecycle.
 * @module webserver/services/aiAssistant/turns
 * @author Mohammed Rawhani
 */

const {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} = require("../../../db/models/ai_message");
const serviceHelpers = require("../../../utils/helper/ai/helpers.js");
const core = require("./core.js");

/**
 * Rejects another chat request while one assistant response is pending in the session.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Study session identifier.
 * @param {Object} [options] - Sequelize query options.
 * @returns {Promise<void>}
 */
async function requireNoPendingMessage(service, userId, studySessionId, options = {}) {
    const pending = await service.server.db.models["ai_message"].getPendingMessage(
        userId, studySessionId, options,
    );
    if (pending) {
        throw new Error("You already have a pending AI request in this session");
    }
}

/**
 * Calls LiteLLM with CARE study and audit metadata.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Validated assistant context.
 * @param {Object} modelParams - Resolved hook model parameters.
 * @param {string} requestId - Request identifier used for logging and abort.
 * @param {Object[]} messages - Complete model messages.
 * @param {number|null} [aiMessageId] - Message linked to the AI log.
 * @param {{onDelta?: function(string): void}} [options] - Internal streaming callback.
 * @returns {Promise<string>} Model response content.
 */
async function requestAssistantCompletion(
    service,
    client,
    context,
    modelParams,
    requestId,
    messages,
    aiMessageId = null,
    options = {},
) {
    const {additionalParameters, ...credentialParams} = modelParams;
    const result = await core.getAIService(service).call("chatCompletion", client, {
        ...additionalParameters,
        ...credentialParams,
        aiHookId: context.hookId,
        studyId: context.studySession.studyId,
        studySessionId: context.studySession.id,
        studyStepId: context.studyStep.id,
        documentId: context.studyStep.documentId,
        __requestId: requestId,
        messages,
    }, {
        onDelta: options.onDelta,
        log: {
            aiMessageId,
            input: serviceHelpers.serializeMessages(messages),
        },
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
}

/**
 * Resolves a hook's prompt and model, then sends the prompt as one user message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Validated assistant context.
 * @param {number} hookId - Hook providing the prompt template and model.
 * @param {Object} values - Placeholder values for the hook template.
 * @param {string} requestId - Request identifier used for logging and abort.
 * @param {number} aiMessageId - Message linked to the AI log.
 * @param {Object} [parameters] - Model parameters that override the hook configuration.
 * @returns {Promise<{output: string, aiModelId: number}>} Model response and used model.
 */
async function requestHookCompletion(
    service,
    client,
    context,
    hookId,
    values,
    requestId,
    aiMessageId,
    parameters = {},
) {
    const aiService = core.getAIService(service);
    const {promptText} = await aiService.call("resolveHookPrompt", client, {hookId, values});
    const modelParams = await aiService.call("resolveHookModel", client, {hookId});
    const output = await requestAssistantCompletion(
        service,
        client,
        {...context, hookId},
        {...modelParams, additionalParameters: {...modelParams.additionalParameters, ...parameters}},
        requestId,
        [{role: "user", content: promptText}],
        aiMessageId,
    );
    return {output, aiModelId: modelParams.aiModelId};
}

/**
 * Loads and validates the latest retryable assistant message and its owned conversation.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Assistant message and request identifiers.
 * @param {Object} descriptor - Conversation-type descriptor.
 * @returns {Promise<Object>} Validated retry target.
 */
async function loadRetryableAssistantMessage(service, client, data, descriptor) {
    const assistantMessageId = serviceHelpers.requireId(data?.assistantMessageId, "assistantMessageId");
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const assistantMessage = await service.server.db.models["ai_message"].getById(assistantMessageId);
    if (
        !assistantMessage ||
        Number(assistantMessage.role) !== AI_MESSAGE_ROLES.ASSISTANT ||
        ![AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED]
            .includes(Number(assistantMessage.status))
    ) {
        throw new Error("AI response cannot be retried");
    }
    const userId = serviceHelpers.requireClientUserId(client);
    const conversation = await service.server.db.models["ai_conversation"].getById(
        assistantMessage.conversationId,
    );
    if (!conversation) {
        throw new Error(descriptor.notFoundMessage);
    }
    await core.loadOwnedConversation(service, conversation.id, userId, conversation.studySessionId, descriptor);
    const latestAssistant = await service.server.db.models["ai_message"].getLatestAssistantMessage(conversation.id);
    if (Number(latestAssistant?.id) !== assistantMessageId) {
        throw new Error("Only the latest AI response can be retried");
    }
    return {assistantMessageId, requestId, assistantMessage, userId, conversation};
}

/**
 * Resets a failed or aborted assistant message back to pending inside one transaction.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Study session identifier.
 * @param {number} conversationId - Conversation identifier.
 * @param {number} assistantMessageId - Assistant message identifier.
 * @returns {Promise<void>}
 */
async function resetMessageForRetry(service, userId, studySessionId, conversationId, assistantMessageId) {
    await service.server.db.sequelize.transaction(async (transaction) => {
        await requireNoPendingMessage(service, userId, studySessionId, {transaction});
        const updatedCount = await service.server.db.models["ai_message"].updateMessageIfStatus(
            assistantMessageId,
            [AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED],
            {status: AI_MESSAGE_STATUSES.PENDING, content: ""},
            {transaction},
        );
        if (updatedCount === 0) {
            throw new Error("AI response cannot be retried");
        }
        await service.server.db.models["ai_conversation"].touchConversation(conversationId, {transaction});
    });
}

/**
 * Aborts the authenticated user's pending assistant response for one conversation type.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Request identifier.
 * @param {Object} descriptor - Conversation-type descriptor.
 * @returns {Promise<Object>} Abort result.
 */
async function abortPendingMessage(service, client, data, descriptor) {
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const userId = serviceHelpers.requireClientUserId(client);
    const models = service.server.db.models;
    const log = await models["ai_log"].findOne({
        where: {requestId, userId, status: "in_progress", deleted: false},
        raw: true,
    });
    if (!log?.aiMessageId) {
        return {aborted: false, message: "No pending AI request found"};
    }

    const assistantMessage = await models["ai_message"].getById(log.aiMessageId);
    if (!assistantMessage || Number(assistantMessage.role) !== AI_MESSAGE_ROLES.ASSISTANT) {
        return {aborted: false, message: "No pending AI response found"};
    }
    const conversation = await models["ai_conversation"].getById(assistantMessage.conversationId);
    if (!conversation) {
        return {aborted: false, message: descriptor.notFoundMessage};
    }
    await core.loadOwnedConversation(service, conversation.id, userId, conversation.studySessionId, descriptor);

    const aborted = await service.server.db.sequelize.transaction(async (transaction) => {
        const updatedCount = await models["ai_message"].updateMessageIfStatus(
            assistantMessage.id, [AI_MESSAGE_STATUSES.PENDING],
            {status: AI_MESSAGE_STATUSES.ABORTED, content: ""}, {transaction},
        );
        if (updatedCount === 0) return false;
        await core.getAIService(service).call("cancelRequest", client, {logId: log.id}, {db: {transaction}});
        return true;
    });
    if (!aborted) {
        return {aborted: false, message: "AI request is no longer pending"};
    }

    const result = await core.getAIService(service).call(
        "abortChatCompletion",
        client,
        {requestId, reason: "request aborted"},
    );
    return {...result, aborted: true};
}

/**
 * Stores the user message and pending assistant within the caller's transaction.
 * @param {Object} service - Assistant service.
 * @param {Object} context - Validated study context.
 * @param {Object} conversation - Owned conversation.
 * @param {Object} values - Server-prepared user and assistant fields.
 * @param {Object} options - Database transaction options.
 * @returns {Promise<Object>} Persisted turn.
 */
async function createTurnMessages(service, context, conversation, values, options) {
    const models = service.server.db.models;
    const base = {conversationId: conversation.id, studyStepId: context.studyStep.id};
    const userMessage = await models["ai_message"].add({
        ...values.user, ...base, role: AI_MESSAGE_ROLES.USER, status: AI_MESSAGE_STATUSES.COMPLETED,
    }, options);
    const assistantMessage = await models["ai_message"].add({
        ...values.assistant, ...base, role: AI_MESSAGE_ROLES.ASSISTANT,
        content: "", status: AI_MESSAGE_STATUSES.PENDING,
    }, options);
    await models["ai_conversation"].touchConversation(conversation.id, options);
    return {conversation, userMessage, assistantMessage};
}

/**
 * Releases an assistant placeholder if it is still pending.
 * @param {Object} service - Assistant service.
 * @param {number} assistantMessageId - Assistant id.
 * @returns {Promise<void>}
 */
async function failAssistantMessage(service, assistantMessageId) {
    await service.server.db.models["ai_message"].updateMessageIfStatus(
        assistantMessageId, [AI_MESSAGE_STATUSES.PENDING],
        {status: AI_MESSAGE_STATUSES.FAILED, content: ""},
    );
}

/**
 * Prepares the complete visible response before changing the pending row.
 * @param {Object} service - Assistant service.
 * @param {Object} turn - Persisted turn.
 * @param {Function} prepareResponse - Async final content/metadata preparation.
 * @returns {Promise<Object>} Completed assistant row.
 */
async function completeTurn(service, turn, prepareResponse) {
    const messages = service.server.db.models["ai_message"];
    try {
        const payload = await prepareResponse();
        const changed = await messages.updateMessageIfStatus(
            turn.assistantMessage.id, [AI_MESSAGE_STATUSES.PENDING],
            {...payload, status: AI_MESSAGE_STATUSES.COMPLETED},
        );
        if (!changed) throw new Error("AI request was aborted");
    } catch (error) {
        try {
            await failAssistantMessage(service, turn.assistantMessage.id);
        } catch (cleanupError) {
            service.server.logger.error("Failed to release pending AI response", cleanupError);
        }
        throw error;
    }
    return messages.getById(turn.assistantMessage.id);
}

/**
 * Returns the persisted turn with safe conversation and context state.
 * @param {Object} service - Assistant service.
 * @param {Object} turn - Persisted turn.
 * @param {Object} assistantMessage - Final assistant row.
 * @returns {Promise<Object>} Shared send/retry result.
 */
async function buildTurnResult(service, turn, assistantMessage) {
    const models = service.server.db.models;
    const {id, studySessionId, type, title, includeContext, createdAt, updatedAt} =
        await models["ai_conversation"].getById(turn.conversation.id);
    return {
        conversationId: id,
        conversation: {id, studySessionId, type, title, includeContext, createdAt, updatedAt},
        userMessage: turn.userMessage,
        assistantMessage,
    };
}

module.exports = {
    requireNoPendingMessage,
    requestAssistantCompletion,
    requestHookCompletion,
    loadRetryableAssistantMessage,
    resetMessageForRetry,
    abortPendingMessage,
    createTurnMessages,
    completeTurn,
    buildTurnResult,
};
