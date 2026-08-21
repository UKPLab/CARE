"use strict";

/**
 * AI assistant turn lifecycle helpers.
 *
 * @module webserver/services/aiAssistant/turns
 * @author Mohammed Rawhani
 */

const {Op} = require("sequelize");
const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const {
    AI_MESSAGE_ROLES,
    AI_MESSAGE_STATUSES,
} = require("../../../db/models/ai_message");

const MODEL_ROLES = {
    [AI_MESSAGE_ROLES.SYSTEM]: "system",
    [AI_MESSAGE_ROLES.USER]: "user",
    [AI_MESSAGE_ROLES.ASSISTANT]: "assistant",
};

/**
 * Builds the completed model-visible history for a conversation.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @returns {Promise<Object[]>} LiteLLM-compatible messages ordered by id.
 */
async function buildModelMessages(service, conversationId) {
    const rows = await service.server.db.models["ai_message"].findAll({
        where: {
            conversationId,
            role: {[Op.in]: Object.keys(MODEL_ROLES).map(Number)},
            status: AI_MESSAGE_STATUSES.COMPLETED,
            deleted: false,
        },
        attributes: ["role", "content"],
        order: [["id", "ASC"]],
        raw: true,
    });
    return rows.map((message) => ({
        role: MODEL_ROLES[message.role],
        content: message.content,
    }));
}

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
    const models = service.server.db.models;
    const pending = await models["ai_message"].findOne({
        where: {
            role: AI_MESSAGE_ROLES.ASSISTANT,
            status: AI_MESSAGE_STATUSES.PENDING,
            deleted: false,
        },
        include: [{
            model: models["ai_conversation"],
            as: "conversation",
            where: {userId, studySessionId, deleted: false},
            attributes: [],
            required: true,
        }],
        attributes: ["id"],
        ...options,
    });
    if (pending) {
        throw new Error("You already have a pending AI request in this session");
    }
}

/**
 * Returns the latest assistant message in a conversation.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @param {Object} [options] - Sequelize query options.
 * @returns {Promise<Object|null>} Latest assistant message.
 */
async function getLatestAssistantMessage(service, conversationId, options = {}) {
    return service.server.db.models["ai_message"].findOne({
        where: {
            conversationId,
            role: AI_MESSAGE_ROLES.ASSISTANT,
            deleted: false,
        },
        order: [["id", "DESC"]],
        raw: true,
        ...options,
    });
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
 * Renders a quoted source as a markdown blockquote.
 *
 * @param {string} text - Quoted text.
 * @returns {string} Blockquote text.
 */
function formatQuote(text) {
    return text.split("\n").map((line) => `> ${line}`).join("\n");
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
    return quote ? `${formatQuote(quote)}\n\n${content}` : content;
}

/**
 * Creates one user turn and its pending assistant placeholder atomically.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Validated chat context.
 * @param {Object|null} conversation - Existing conversation, or null for a new one.
 * @param {string} content - User message content.
 * @param {Object} modelParams - Resolved hook model parameters.
 * @param {string|null} systemPrompt - System context needed for this step.
 * @param {Object|null} userMetadata - Optional user-message metadata.
 * @returns {Promise<Object>} Conversation, user message, and assistant placeholder.
 */
async function createTurn(service, context, conversation, content, modelParams, systemPrompt, userMetadata = null) {
    const models = service.server.db.models;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );

        let currentConversation = conversation;
        if (!currentConversation) {
            currentConversation = await models["ai_conversation"].add({
                userId: context.userId,
                studySessionId: context.studySession.id,
                type: AI_CONVERSATION_TYPES.CHAT,
                title: content,
            }, {transaction});
        }

        const existingSystemMessage = await models["ai_message"].findOne({
            where: {
                conversationId: currentConversation.id,
                studyStepId: context.studyStep.id,
                role: AI_MESSAGE_ROLES.SYSTEM,
                deleted: false,
            },
            attributes: ["id"],
            transaction,
        });
        if (!existingSystemMessage) {
            if (systemPrompt === null) {
                throw new Error("AI Chat context is missing for this study step");
            }
            await models["ai_message"].add({
                conversationId: currentConversation.id,
                studyStepId: context.studyStep.id,
                aiModelId: modelParams.aiModelId,
                role: AI_MESSAGE_ROLES.SYSTEM,
                content: systemPrompt,
                status: AI_MESSAGE_STATUSES.COMPLETED,
            }, {transaction});
        }

        const userMessage = await models["ai_message"].add({
            conversationId: currentConversation.id,
            studyStepId: context.studyStep.id,
            aiModelId: modelParams.aiModelId,
            role: AI_MESSAGE_ROLES.USER,
            content: buildUserContent(content, userMetadata),
            metadata: userMetadata,
            status: AI_MESSAGE_STATUSES.COMPLETED,
        }, {transaction});
        const assistantMessage = await models["ai_message"].add({
            conversationId: currentConversation.id,
            studyStepId: context.studyStep.id,
            aiModelId: modelParams.aiModelId,
            role: AI_MESSAGE_ROLES.ASSISTANT,
            content: "",
            status: AI_MESSAGE_STATUSES.PENDING,
        }, {transaction});
        await models["ai_conversation"].updateById(
            currentConversation.id,
            {updatedAt: new Date()},
            {transaction},
        );

        return {conversation: currentConversation, userMessage, assistantMessage};
    });
}

/**
 * Marks an assistant placeholder failed only while it is still pending.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} assistantMessageId - Assistant message identifier.
 * @returns {Promise<void>}
 */
async function failAssistantMessage(service, assistantMessageId) {
    await service.server.db.models["ai_message"].update({
        status: AI_MESSAGE_STATUSES.FAILED,
        content: "",
    }, {
        where: {
            id: assistantMessageId,
            status: AI_MESSAGE_STATUSES.PENDING,
            deleted: false,
        },
    });
}

module.exports = {
    buildModelMessages,
    requireNoPendingMessage,
    getLatestAssistantMessage,
    buildQuoteMetadata,
    createTurn,
    failAssistantMessage,
};
