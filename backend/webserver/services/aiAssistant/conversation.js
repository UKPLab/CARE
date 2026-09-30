"use strict";

/**
 * Persistent AI conversation orchestration.
 *
 * @module webserver/services/aiAssistant/conversation
 * @author Mohammed Rawhani
 */

const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} = require("../../../db/models/ai_message");
const serviceHelpers = require("../../../utils/helper/ai/helpers.js");
const turns = require("./turns.js");
const core = require("./core.js");

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
 * Creates one user turn and its pending assistant placeholder atomically.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Validated chat context.
 * @param {Object|null} existingConversation - Existing conversation, or null for a new one.
 * @param {Object} data - Prepared message data.
 * @param {string} data.content - User message content.
 * @param {Object} data.modelParams - Resolved model parameters.
 * @param {Object|null} data.systemContext - Initial prompt context.
 * @param {Object|null} [data.userMetadata=null] - User-message metadata.
 * @param {string} data.requestId - Request that owns the assistant placeholder.
 * @returns {Promise<Object>} Conversation, user message, and assistant placeholder.
 */
async function createConversationTurn(service, context, existingConversation, data) {
    const {content, modelParams, systemContext, userMetadata = null, requestId} = data;
    const models = service.server.db.models;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await turns.requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );

        let conversation = existingConversation;
        if (!conversation) {
            conversation = await models["ai_conversation"].add({
                userId: context.userId,
                studySessionId: context.studySession.id,
                type: AI_CONVERSATION_TYPES.CHAT,
                title: content,
                includeContext: context.includeContext,
            }, {transaction});
        }

        if (!existingConversation && context.includeContext) {
            if (systemContext === null) {
                throw new Error("AI Chat context is missing for this study step");
            }
            await models["ai_message"].add({
                conversationId: conversation.id,
                studyStepId: context.studyStep.id,
                aiModelId: modelParams.aiModelId,
                role: AI_MESSAGE_ROLES.SYSTEM,
                content: systemContext.promptText,
                status: AI_MESSAGE_STATUSES.COMPLETED,
            }, {transaction});
        }

        return turns.createTurnMessages(service, context, conversation, {
            requestId,
            user: {aiModelId: modelParams.aiModelId, content: buildUserContent(content, userMetadata), metadata: userMetadata},
            assistant: {aiModelId: modelParams.aiModelId},
        }, {transaction});
    });
}

const CHAT = {
    conversationType: AI_CONVERSATION_TYPES.CHAT,
    notFoundMessage: "AI conversation not found",
};


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
        {requireOpen},
    );
    if (requireCurrentStep && Number(studySession.studyStepId) !== Number(studyStep.id)) {
        throw new Error("AI Chat is only available for the current study step");
    }

    const services = Array.isArray(studyStep.configuration?.services)
        ? studyStep.configuration.services
        : [];
    const serviceConfig = services.find((entry) => entry?.type === "aiChat");
    const hookId = Number(serviceConfig?.hookId);
    if (!serviceConfig || !Number.isInteger(hookId) || hookId <= 0) {
        throw new Error("AI Chat is not configured for this study step");
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
 * Lists the enabled models configured for a hook.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {number} hookId - AI hook identifier.
 * @returns {Promise<Object[]>} Safe model options ordered by hook priority.
 */
async function getHookModels(service, client, hookId) {
    const models = service.server.db.models;
    const aiService = core.getAIService(service);
    const rows = await models["ai_hook_models"].findAll({
        where: {aiHookId: hookId, deleted: false},
        order: [["priority", "ASC"]],
        raw: true,
    });
    const available = await Promise.all(rows.map(async (row) => {
        try {
            await aiService.call("resolveHookModel", client, {hookId, aiModelId: row.aiModelId});
            const model = await models["ai_model"].getById(row.aiModelId);
            return model
                ? {id: model.id, name: model.name || model.model, priority: row.priority}
                : null;
        } catch (_error) {
            return null;
        }
    }));
    return available.filter(Boolean);
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
        ? serviceHelpers.requireId(data.conversationId, "conversationId")
        : null;
    const activeConversation = requestedConversationId
        ? conversations.find((conversation) => Number(conversation.id) === Number(requestedConversationId))
        : conversations[0] || null;
    if (requestedConversationId && !activeConversation) {
        throw new Error("AI conversation not found");
    }
    const models = await getHookModels(service, client, context.hookId);

    return {
        conversations,
        activeConversationId: activeConversation?.id || null,
        includeContext: activeConversation?.includeContext !== false,
        messages: activeConversation ? await service.server.db.models["ai_message"].getVisibleMessages(activeConversation.id) : [],
        models,
        defaultModelId: models[0]?.id || null,
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
        throw new Error("Message content is required");
    }
    const userMetadata = buildQuoteMetadata(context, data?.quote);
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const conversation = data?.conversationId
        ? await core.loadOwnedConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
            CHAT,
        )
        : null;
    context.includeContext = (conversation || data)?.includeContext !== false;
    const modelParams = await core.getAIService(service).call(
        "resolveHookModel",
        client,
        {hookId: context.hookId, aiModelId: data?.aiModelId},
    );

    let systemContext = null;
    if (context.includeContext && !conversation) {
        const values = core.buildPromptValues(context.serviceConfig.inputs, data?.values);
        const prompt = await core.getAIService(service).call(
            "resolveHookPrompt",
            client,
            {hookId: context.hookId, values},
        );
        systemContext = {promptText: prompt.promptText};
    }

    const turn = await createConversationTurn(
        service,
        context,
        conversation,
        {content, modelParams, systemContext, userMetadata, requestId},
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

/**
 * Completes a chat response using its full stored model history.
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated chat context.
 * @param {Object} turn - Persisted turn.
 * @param {Object} modelParams - Resolved model parameters.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Completed turn and conversation state.
 */
async function completeConversationTurn(service, client, context, turn, modelParams, requestId) {
    const assistantMessage = await turns.completeTurn(service, turn, requestId, async () => {
        const messages = await service.server.db.models["ai_message"].getModelMessages(turn.conversation.id);
        const content = await turns.requestAssistantCompletion(
            service, client, context,
            {modelParams, requestId, messages, aiMessageId: turn.assistantMessage.id},
            {onDelta: createConversationStream(service, client, context, turn, requestId)},
        );
        return {content};
    });
    return turns.buildTurnResult(service, turn, assistantMessage);
}

/**
 * Forwards temporary chat text to the requesting socket.
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
        }).catch((error) => service.server.logger.error("Failed to send AI chat text: " + error.message));
    };
}

module.exports = {
    getConversation,
    sendConversationMessage,
    retryConversationMessage,
    abortConversationMessage,
};
