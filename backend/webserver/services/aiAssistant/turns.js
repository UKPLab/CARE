"use strict";

/**
 * AI assistant turn persistence and completion lifecycle.
 *
 * @module webserver/services/aiAssistant/turns
 * @author Mohammed Rawhani
 */

const TranslatableError = require("../../../utils/TranslatableError");

const {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} = require("../../../db/models/ai_message");
const helpers = require("../../../utils/helper/ai/helpers.js");
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
        throw new TranslatableError("errors.ai.requestAlreadyPending");
    }
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
    const assistantMessageId = helpers.requireId(data?.assistantMessageId, "assistantMessageId");
    const requestId = helpers.requireRequestId(data?.requestId);
    const assistantMessage = await service.server.db.models["ai_message"].getById(assistantMessageId);
    if (
        !assistantMessage ||
        Number(assistantMessage.role) !== AI_MESSAGE_ROLES.ASSISTANT ||
        ![AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED]
            .includes(Number(assistantMessage.status))
    ) {
        throw new TranslatableError("errors.ai.assistant.retryNotAllowed");
    }
    const userId = helpers.requireClientUserId(client);
    const conversation = await service.server.db.models["ai_conversation"].getById(
        assistantMessage.conversationId,
    );
    if (!conversation) {
        throw new TranslatableError(descriptor.notFoundKey);
    }
    await core.loadOwnedConversation(service, conversation.id, userId, conversation.studySessionId, descriptor);
    const latestAssistant = await service.server.db.models["ai_message"].getLatestAssistantMessage(conversation.id);
    if (Number(latestAssistant?.id) !== assistantMessageId) {
        throw new TranslatableError("errors.ai.assistant.retryLatestOnly");
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
 * @param {string} requestId - Retry request that takes ownership of the message.
 * @returns {Promise<void>}
 */
async function resetMessageForRetry(service, userId, studySessionId, conversationId, assistantMessageId, requestId) {
    await service.server.db.sequelize.transaction(async (transaction) => {
        await requireNoPendingMessage(service, userId, studySessionId, {transaction});
        const updatedCount = await service.server.db.models["ai_message"].updateMessageIfStatus(
            assistantMessageId,
            {status: AI_MESSAGE_STATUSES.PENDING, content: "", requestId},
            [AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED],
            null,
            {transaction},
        );
        if (updatedCount === 0) {
            throw new TranslatableError("errors.ai.assistant.retryNotAllowed");
        }
        await service.server.db.models["ai_conversation"].touch(conversationId, {transaction});
    });
}

/**
 * Aborts the authenticated user's pending assistant response for one conversation type.
 *
 * The shared `abortChatCompletion` stops the provider and closes its AI log.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Request identifier.
 * @param {Object} descriptor - Conversation-type descriptor.
 * @returns {Promise<Object>} Abort result.
 */
async function abortPendingMessage(service, client, data, descriptor) {
    const requestId = helpers.requireRequestId(data?.requestId);
    const userId = helpers.requireClientUserId(client);
    const models = service.server.db.models;
    const assistantMessage = await models["ai_message"].getPendingMessageByRequestId(requestId);
    if (!assistantMessage) {
        return {aborted: false, key: "errors.ai.requestNotAbortable"};
    }
    const conversation = await models["ai_conversation"].getById(assistantMessage.conversationId);
    if (!conversation) {
        return {aborted: false, key: descriptor.notFoundKey};
    }
    await core.loadOwnedConversation(service, conversation.id, userId, conversation.studySessionId, descriptor);

    // Stop the provider first; the shared abort only finds requests that are still in progress.
    const providerResult = await core.getAIService(service).call(
        "abortChatCompletion",
        client,
        {requestId, reason: "request aborted"},
    );
    const updatedCount = await models["ai_message"].updateMessageIfStatus(
        assistantMessage.id, {status: AI_MESSAGE_STATUSES.ABORTED, content: ""},
        [AI_MESSAGE_STATUSES.PENDING], requestId,
    );
    // The stopped request may already have marked the message failed.
    if (updatedCount === 0 && providerResult?.aborted !== true) {
        return {aborted: false, key: "errors.ai.requestNotAbortable"};
    }
    return {aborted: true};
}

/**
 * Creates the conversation and its first system message when a turn starts a new conversation.
 *
 * @param {Object} service - Assistant service.
 * @param {Object|null} existingConversation - Existing conversation, or null for a new one.
 * @param {Object} data - Fields prepared by the conversation type.
 * @param {Object} data.conversation - Fields of a new conversation.
 * @param {Object|null} data.systemMessage - Fields of its system message, or null for none.
 * @param {Object} options - Database transaction options.
 * @returns {Promise<Object>} Existing or new conversation.
 */
async function ensureConversation(service, existingConversation, data, options) {
    if (existingConversation) return existingConversation;
    const models = service.server.db.models;
    const conversation = await models["ai_conversation"].add(data.conversation, options);
    if (data.systemMessage) {
        await models["ai_message"].add({
            ...data.systemMessage,
            conversationId: conversation.id,
            role: AI_MESSAGE_ROLES.SYSTEM,
            status: AI_MESSAGE_STATUSES.COMPLETED,
        }, options);
    }
    return conversation;
}

/**
 * Stores the user message and pending assistant within the caller's transaction.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} context - Validated study context.
 * @param {Object} conversation - Owned conversation.
 * @param {Object} data - Prepared message fields.
 * @param {string} data.requestId - Request that owns the pending assistant.
 * @param {Object} data.user - User-message fields.
 * @param {Object} data.assistant - Assistant-message fields.
 * @param {Object} options - Database transaction options.
 * @returns {Promise<Object>} Persisted turn.
 */
async function createTurnMessages(service, context, conversation, data, options) {
    const models = service.server.db.models;
    const base = {conversationId: conversation.id, studyStepId: context.studyStep.id};
    const userMessage = await models["ai_message"].add({
        ...data.user, ...base, role: AI_MESSAGE_ROLES.USER, status: AI_MESSAGE_STATUSES.COMPLETED,
    }, options);
    const assistantMessage = await models["ai_message"].add({
        ...data.assistant, ...base, role: AI_MESSAGE_ROLES.ASSISTANT,
        content: "", status: AI_MESSAGE_STATUSES.PENDING, requestId: data.requestId,
    }, options);
    await models["ai_conversation"].touch(conversation.id, options);
    return {conversation, userMessage, assistantMessage};
}

/**
 * Releases an assistant placeholder if it is still pending.
 *
 * @param {Object} service - Assistant service.
 * @param {number} assistantMessageId - Assistant id.
 * @param {string} requestId - Request that must still own the assistant.
 * @returns {Promise<void>}
 */
async function failAssistantMessage(service, assistantMessageId, requestId) {
    await service.server.db.models["ai_message"].updateMessageIfStatus(
        assistantMessageId, {status: AI_MESSAGE_STATUSES.FAILED, content: ""},
        [AI_MESSAGE_STATUSES.PENDING], requestId,
    );
}

/**
 * Prepares the complete visible response before changing the pending row.
 *
 * Writes only while `requestId` owns the row, so a stopped request cannot overwrite a retry.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} turn - Persisted turn.
 * @param {string} requestId - Request that owns the pending assistant.
 * @param {Function} prepareResponse - Async final content/metadata preparation.
 * @returns {Promise<Object>} Completed assistant row.
 */
async function completeTurn(service, turn, requestId, prepareResponse) {
    const messages = service.server.db.models["ai_message"];
    try {
        const payload = await prepareResponse();
        const changed = await messages.updateMessageIfStatus(
            turn.assistantMessage.id, {...payload, status: AI_MESSAGE_STATUSES.COMPLETED},
            [AI_MESSAGE_STATUSES.PENDING], requestId,
        );
        if (!changed) throw new TranslatableError("errors.ai.assistant.requestAborted");
    } catch (error) {
        try {
            await failAssistantMessage(service, turn.assistantMessage.id, requestId);
        } catch (cleanupError) {
            service.logger.error("Failed to release pending AI response", cleanupError);
        }
        throw error;
    }
    return messages.getById(turn.assistantMessage.id);
}

/**
 * Returns the persisted turn with safe conversation and context state.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} turn - Persisted turn.
 * @param {Object} assistantMessage - Final assistant row.
 * @returns {Promise<Object>} Shared send/retry result.
 */
async function buildTurnResult(service, turn, assistantMessage) {
    const conversation = await service.server.db.models["ai_conversation"].getById(turn.conversation.id, {
        attributes: ["id", "studySessionId", "type", "title", "includeContext", "createdAt", "updatedAt"],
    });
    return {
        conversationId: conversation.id,
        conversation,
        userMessage: turn.userMessage,
        assistantMessage,
    };
}

module.exports = {
    requireNoPendingMessage,
    loadRetryableAssistantMessage,
    resetMessageForRetry,
    abortPendingMessage,
    ensureConversation,
    createTurnMessages,
    completeTurn,
    buildTurnResult,
};
