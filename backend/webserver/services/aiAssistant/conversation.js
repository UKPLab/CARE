"use strict";

/**
 * Persistent AI conversation orchestration.
 *
 * @module webserver/services/aiAssistant/conversation
 * @author Mohammed Rawhani
 */

const TranslatableError = require("../../../utils/TranslatableError");

const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const helpers = require("../../../utils/helper/ai/helpers.js");
const completion = require("./completion.js");
const turns = require("./turns.js");
const core = require("./core.js");

const CHAT = {
    conversationType: AI_CONVERSATION_TYPES.CHAT,
    notFoundKey: "errors.ai.chat.conversationNotFound",
    currentStepKey: "errors.ai.chat.currentStepOnly",
};

// Chat context guard, as fractions of the model's context window: soft nudges the
// student to start fresh, hard blocks sending. Hard stays below 1 so the answer
// still fits inside the window.
const CONTEXT_SOFT_RATIO = 0.65;
const CONTEXT_HARD_RATIO = 0.85;

/**
 * Estimates a conversation's current token size from its stored model history.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @returns {Promise<number>} Estimated tokens.
 */
async function estimateConversationTokens(service, conversationId) {
    const length = await service.server.db.models["ai_message"].getModelContentLength(conversationId);
    return helpers.estimateTokens(length);
}

/**
 * Flags a conversation whose size passes the soft fraction of the model window,
 * so the UI can suggest starting fresh. No window configured means no cap.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @param {number|null} contextWindowTokens - Model context window, or null.
 * @returns {Promise<boolean>} Whether the conversation nears the limit.
 */
async function isContextNearLimit(service, conversationId, contextWindowTokens) {
    if (!contextWindowTokens) return false;
    const tokens = await estimateConversationTokens(service, conversationId);
    return tokens > contextWindowTokens * CONTEXT_SOFT_RATIO;
}

/**
 * Normalizes optional quoted-source metadata for a user message.
 *
 * @param {Object} context - Validated chat context.
 * @param {Object|null} quote - Quote payload from the client.
 * @returns {Object|null} Message metadata, or null when no quote is attached.
 */
function buildQuoteMetadata(context, quote) {
    const text = typeof quote?.text === "string" ? quote.text.trim() : "";
    if (!text) return null;
    return {
        quote: {
            text,
            documentId: Number(quote.documentId) || context.studyStep.documentId || null,
            studyStepId: Number(quote.studyStepId) || context.studyStep.id,
            selectors: quote.selectors || null,
        },
    };
}

/**
 * Builds the stored and model-visible user message content.
 *
 * @param {string} content - User question text.
 * @param {Object|null} metadata - Optional message metadata.
 * @returns {string} Final message content.
 */
function buildUserContent(content, metadata) {
    const quote = metadata?.quote?.text;
    if (!quote) return content;
    const blockquote = quote.split("\n").map((line) => `> ${line}`).join("\n");
    return `${blockquote}\n\n${content}`;
}

/**
 * Loads the authenticated study session, step, and AI Chat service declaration.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {number} studySessionId - Study session identifier.
 * @param {number} studyStepId - Study step identifier.
 * @param {Object} [options] - Context validation options.
 * @param {boolean} [options.requireCurrentStep=true] - Whether the step must be the session's current step.
 * @param {boolean} [options.requireOpen=true] - Whether the session and study must still be open.
 * @returns {Promise<Object>} Validated chat context.
 */
async function loadChatContext(
    service,
    client,
    studySessionId,
    studyStepId,
    {requireCurrentStep = true, requireOpen = true} = {},
) {
    const {userId, studySession, studyStep} = await core.loadStudyStepContext(
        service,
        client,
        studySessionId,
        studyStepId,
        {requireOpen, currentStepKey: requireCurrentStep ? CHAT.currentStepKey : null},
    );
    const serviceConfig = core.getStepServices(studyStep).find((entry) => entry?.type === "aiChat");
    const hookId = Number(serviceConfig?.hookId);
    if (!serviceConfig || !Number.isInteger(hookId) || hookId <= 0) {
        throw new TranslatableError("errors.ai.chat.notConfigured");
    }
    await core.getAIService(service).call("loadHook", client, {hookId});

    return {
        userId,
        studySession,
        studyStep,
        serviceConfig,
        hookId,
    };
}

/**
 * Creates one user turn and its pending assistant placeholder atomically.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Validated chat context.
 * @param {Object|null} existingConversation - Existing conversation, or null for a new one.
 * @param {Object} data - Prepared message data.
 * @param {string} data.content - User message content.
 * @param {Object} data.modelParams - Resolved model parameters.
 * @param {boolean} data.includeContext - Whether a new conversation gets the study context.
 * @param {Object|null} data.systemMessage - System message fields for a new conversation, or null.
 * @param {Object|null} [data.userMetadata=null] - User-message metadata.
 * @param {string} data.requestId - Request that owns the assistant placeholder.
 * @returns {Promise<Object>} Conversation, user message, and assistant placeholder.
 */
async function createConversationTurn(service, context, existingConversation, data) {
    const {content, modelParams, includeContext, systemMessage, userMetadata = null, requestId} = data;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await turns.requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );
        const conversation = await turns.ensureConversation(service, existingConversation, {
            conversation: {
                userId: context.userId,
                studySessionId: context.studySession.id,
                type: AI_CONVERSATION_TYPES.CHAT,
                title: content,
                includeContext,
            },
            systemMessage,
        }, {transaction});

        return turns.createTurnMessages(service, context, conversation, {
            requestId,
            user: {aiModelId: modelParams.aiModelId, content: buildUserContent(content, userMetadata), metadata: userMetadata},
            assistant: {aiModelId: modelParams.aiModelId},
        }, {transaction});
    });
}

/**
 * Forwards temporary chat text to the requesting socket.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated study context.
 * @param {Object} turn - Persisted conversation and assistant message.
 * @param {string} requestId - Current request identifier.
 * @returns {function(string): void} Temporary text callback.
 */
function createConversationStream(service, client, context, turn, requestId) {
    return (text) => {
        service.send(client, "conversationDelta", {
            requestId,
            conversationId: turn.conversation.id,
            assistantMessageId: turn.assistantMessage.id,
            studySessionId: context.studySession.id,
            studyStepId: context.studyStep.id,
            text,
        }).catch((error) => service.logger.error("Failed to send AI chat text: " + error.message));
    };
}

/**
 * Completes a chat response using its full stored model history.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated chat context.
 * @param {Object} turn - Persisted turn.
 * @param {Object} modelParams - Resolved model parameters.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Completed turn and conversation state.
 */
async function completeConversationTurn(service, client, context, turn, modelParams, requestId) {
    let turnTokens = 0;
    const assistantMessage = await turns.completeTurn(service, turn, requestId, async () => {
        const messages = await service.server.db.models["ai_message"].getModelMessages(turn.conversation.id);
        const content = await completion.requestAssistantCompletion(
            service, client, context,
            {modelParams, requestId, messages, aiMessageId: turn.assistantMessage.id},
            createConversationStream(service, client, context, turn, requestId),
        );
        // Reuse the prompt just built plus the reply, instead of re-reading the conversation.
        turnTokens = helpers.sumMessageTokens(messages) + helpers.estimateTokens(content);
        return {content};
    });
    const result = await turns.buildTurnResult(service, turn, assistantMessage);
    result.contextNearLimit = modelParams.contextWindowTokens
        ? turnTokens > modelParams.contextWindowTokens * CONTEXT_SOFT_RATIO
        : false;
    return result;
}

/**
 * Loads the chat snapshot for a study session.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Session, step, and optional conversation identifiers.
 * @returns {Promise<Object>} Conversations, visible messages, context state, and model options.
 */
async function getConversation(service, client, data) {
    const context = await loadChatContext(
        service,
        client,
        data?.studySessionId,
        data?.studyStepId,
        {requireCurrentStep: false, requireOpen: false},
    );
    const conversations = await service.server.db.models["ai_conversation"].getSessionConversations(
        context.userId, context.studySession.id, AI_CONVERSATION_TYPES.CHAT,
    );

    const requestedConversationId = data?.conversationId
        ? helpers.requireId(data.conversationId, "conversationId")
        : null;
    const activeConversation = requestedConversationId
        ? conversations.find((conversation) => Number(conversation.id) === Number(requestedConversationId))
        : conversations[0] || null;
    if (requestedConversationId && !activeConversation) {
        throw new TranslatableError("errors.ai.chat.conversationNotFound");
    }
    const models = await core.getAIService(service).call("listHookModels", client, {hookId: context.hookId});

    const defaultModel = models[0] || null;
    const defaultModelId = defaultModel?.id || null;
    let contextNearLimit = false;
    if (activeConversation && defaultModel) {
        contextNearLimit = await isContextNearLimit(service, activeConversation.id, defaultModel.contextWindowTokens);
    }

    return {
        conversations,
        activeConversationId: activeConversation?.id || null,
        includeContext: activeConversation?.includeContext !== false,
        messages: activeConversation ? await service.server.db.models["ai_message"].getVisibleMessages(activeConversation.id) : [],
        models,
        defaultModelId,
        contextNearLimit,
    };
}

/**
 * Creates or continues a chat conversation and streams the model response.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Message, context values, model, and study identifiers.
 * @param {boolean} [data.includeContext=true] - Include study context when creating a conversation.
 * @returns {Promise<Object>} Completed visible turn.
 */
async function sendConversationMessage(service, client, data) {
    const context = await loadChatContext(
        service,
        client,
        data?.studySessionId,
        data?.studyStepId,
    );
    const content = typeof data?.content === "string" ? data.content.trim() : "";
    if (!content) {
        throw new TranslatableError("errors.ai.chat.contentRequired");
    }
    const userMetadata = buildQuoteMetadata(context, data?.quote);
    const requestId = helpers.requireRequestId(data?.requestId);
    const conversation = data?.conversationId
        ? await core.loadOwnedConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
            CHAT,
        )
        : null;
    const includeContext = (conversation || data)?.includeContext !== false;
    const modelParams = await core.getAIService(service).call(
        "resolveHookModel",
        client,
        {hookId: context.hookId, aiModelId: data?.aiModelId},
    );

    // Block an existing chat that would pass the hard fraction of the model window.
    if (conversation && modelParams.contextWindowTokens) {
        const historyTokens = await estimateConversationTokens(service, conversation.id);
        const projectedTokens = historyTokens + helpers.estimateTokens(content);
        if (projectedTokens > modelParams.contextWindowTokens * CONTEXT_HARD_RATIO) {
            throw new TranslatableError("errors.ai.chat.conversationTooLong");
        }
    }

    let systemMessage = null;
    if (includeContext && !conversation) {
        const {promptText} = await core.resolveContextPrompt(
            service, client, context.hookId, context.serviceConfig.inputs, data?.values,
        );
        if (!promptText) {
            throw new TranslatableError("errors.ai.chat.contextMissing");
        }
        systemMessage = {studyStepId: context.studyStep.id, aiModelId: modelParams.aiModelId, content: promptText};
    }

    const turn = await createConversationTurn(
        service,
        context,
        conversation,
        {content, modelParams, includeContext, systemMessage, userMetadata, requestId},
    );
    return completeConversationTurn(service, client, context, turn, modelParams, requestId);
}

/**
 * Retries the latest failed or aborted assistant response without duplicating the user message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Assistant message and request identifiers.
 * @returns {Promise<Object>} Completed assistant response.
 */
async function retryConversationMessage(service, client, data) {
    const {assistantMessageId, requestId, assistantMessage, userId, conversation} =
        await turns.loadRetryableAssistantMessage(service, client, data, CHAT);
    const context = await loadChatContext(
        service,
        client,
        conversation.studySessionId,
        assistantMessage.studyStepId,
        {requireCurrentStep: false},
    );
    const modelParams = await core.getAIService(service).call(
        "resolveHookModel",
        client,
        {hookId: context.hookId, aiModelId: assistantMessage.aiModelId},
    );
    await turns.resetMessageForRetry(
        service,
        userId,
        conversation.studySessionId,
        conversation.id,
        assistantMessageId,
        requestId,
    );

    return completeConversationTurn(
        service, client, context, {conversation, userMessage: null, assistantMessage}, modelParams, requestId,
    );
}

/**
 * Aborts the authenticated user's pending chat response.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Request identifier.
 * @returns {Promise<Object>} Abort result.
 */
async function abortConversationMessage(service, client, data) {
    return turns.abortPendingMessage(service, client, data, CHAT);
}

module.exports = {
    getConversation,
    sendConversationMessage,
    retryConversationMessage,
    abortConversationMessage,
};
