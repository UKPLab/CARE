"use strict";

/**
 * Persistent AI conversation orchestration.
 *
 * @module webserver/services/aiAssistant/conversation
 * @author Mohammed Rawhani
 */

const {Op} = require("sequelize");
const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const {
    AI_MESSAGE_ROLES,
    AI_MESSAGE_STATUSES,
} = require("../../../db/models/ai_message");
const serviceHelpers = require("../../../utils/helper/ai/helpers.js");
const turns = require("./turns.js");


/**
 * Returns the shared AI execution service.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @returns {Object} Registered AIService instance.
 */
function getAIService(service) {
    const aiService = service.server.services["AIService"];
    if (!aiService) {
        throw new Error("AIService is not available");
    }
    return aiService;
}

/**
 * Loads the authenticated study session, step, and AI Chat service declaration.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {number} studySessionId - Study session identifier.
 * @param {number} studyStepId - Study step identifier.
 * @param {boolean} [requireCurrentStep=true] - Whether the step must be the session's current step.
 * @returns {Promise<Object>} Validated chat context.
 */
async function loadChatContext(
    service,
    client,
    studySessionId,
    studyStepId,
    requireCurrentStep = true,
) {
    const userId = serviceHelpers.requireClientUserId(client);
    const models = service.server.db.models;
    const sessionId = serviceHelpers.requireId(studySessionId, "studySessionId");
    const stepId = serviceHelpers.requireId(studyStepId, "studyStepId");
    const studySession = await models["study_session"].getById(sessionId);
    if (!studySession || Number(studySession.userId) !== userId) {
        throw new Error("Study session not found");
    }

    const studyStep = await models["study_step"].getById(stepId);
    if (!studyStep || Number(studyStep.studyId) !== Number(studySession.studyId)) {
        throw new Error("Study step does not belong to this study session");
    }
    if (requireCurrentStep && Number(studySession.studyStepId) !== stepId) {
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
    await getAIService(service).call("loadHook", client, {hookId});

    return {
        userId,
        studySession,
        studyStep,
        serviceConfig,
        hookId,
    };
}

/**
 * Loads and validates a chat conversation owned by the authenticated user.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Expected study session identifier.
 * @param {Object} [options] - Sequelize query options.
 * @returns {Promise<Object>} Owned chat conversation.
 */
async function loadConversation(
    service,
    conversationId,
    userId,
    studySessionId,
    options = {},
) {
    const conversation = await service.server.db.models["ai_conversation"].getById(
        serviceHelpers.requireId(conversationId, "conversationId"),
        options,
    );
    if (
        !conversation ||
        Number(conversation.userId) !== userId ||
        Number(conversation.studySessionId) !== Number(studySessionId) ||
        Number(conversation.type) !== AI_CONVERSATION_TYPES.CHAT
    ) {
        throw new Error("AI conversation not found");
    }
    return conversation;
}

/**
 * Loads messages safe to display in the chat interface.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @returns {Promise<Object[]>} User and assistant messages ordered by id.
 */
async function getVisibleMessages(service, conversationId) {
    return service.server.db.models["ai_message"].findAll({
        where: {
            conversationId,
            role: {[Op.in]: [AI_MESSAGE_ROLES.USER, AI_MESSAGE_ROLES.ASSISTANT]},
            deleted: false,
        },
        attributes: [
            "id",
            "conversationId",
            "studyStepId",
            "aiModelId",
            "role",
            "content",
            "metadata",
            "status",
            "createdAt",
            "updatedAt",
        ],
        order: [["id", "ASC"]],
        raw: true,
    });
}

/**
 * Lists the steps whose system context is already stored in a conversation.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @returns {Promise<number[]>} Introduced study step identifiers.
 */
async function getIntroducedContextStepIds(service, conversationId) {
    const rows = await service.server.db.models["ai_message"].findAll({
        where: {
            conversationId,
            role: AI_MESSAGE_ROLES.SYSTEM,
            status: AI_MESSAGE_STATUSES.COMPLETED,
            deleted: false,
        },
        attributes: ["studyStepId"],
        order: [["id", "ASC"]],
        raw: true,
    });
    return [...new Set(rows.map((message) => Number(message.studyStepId)).filter(Boolean))];
}

/**
 * Lists the enabled models configured for a hook.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} hookId - AI hook identifier.
 * @returns {Promise<Object[]>} Safe model options ordered by hook priority.
 */
async function getHookModels(service, client, hookId) {
    const models = service.server.db.models;
    const aiService = getAIService(service);
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
    );
    const conversations = await service.server.db.models["ai_conversation"].findAll({
        where: {
            userId: context.userId,
            studySessionId: context.studySession.id,
            type: AI_CONVERSATION_TYPES.CHAT,
            deleted: false,
        },
        attributes: ["id", "studySessionId", "type", "title", "createdAt", "updatedAt"],
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        raw: true,
    });

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
        messages: activeConversation ? await getVisibleMessages(service, activeConversation.id) : [],
        introducedContextStepIds: activeConversation
            ? await getIntroducedContextStepIds(service, activeConversation.id)
            : [],
        models,
        defaultModelId: models[0]?.id || null,
    };
}

/**
 * Builds trusted prompt values from the stored mapping and caller-resolved content.
 *
 * @param {Object} inputMappings - Stored AI Chat input mappings.
 * @param {Object} suppliedValues - Values resolved by the frontend.
 * @returns {Object} Values safe to pass to the hook resolver.
 */
function buildPromptValues(inputMappings, suppliedValues) {
    const mappings = inputMappings && typeof inputMappings === "object" ? inputMappings : {};
    const supplied = suppliedValues && typeof suppliedValues === "object" ? suppliedValues : {};
    const values = {};

    for (const [key, mapping] of Object.entries(mappings)) {
        if (!Object.prototype.hasOwnProperty.call(supplied, key)) {
            throw new Error(`Missing AI Chat input: ${key}`);
        }
        if (mapping?.type === "configuration") {
            values[key] = {type: "serviceReplacement", input: mapping};
            continue;
        }
        if (mapping?.type === "submission") {
            const pdfText = supplied[key]?.input?.pdfText ?? null;
            values[key] = {
                type: "serviceReplacement",
                input: {...mapping, pdfText},
            };
            continue;
        }
        values[key] = supplied[key];
    }
    return values;
}

/**
 * Runs LiteLLM for an existing pending assistant placeholder.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Validated chat context.
 * @param {Object} conversation - Target conversation.
 * @param {Object|null} userMessage - Newly created user message, if any.
 * @param {Object} assistantMessage - Pending assistant message.
 * @param {Object} modelParams - Resolved hook model parameters.
 * @param {string} requestId - Request identifier used for logging and abort.
 * @returns {Promise<Object>} Completed visible turn.
 */
async function runAssistantRequest(
    service,
    client,
    context,
    conversation,
    userMessage,
    assistantMessage,
    modelParams,
    requestId,
) {
    const {additionalParameters, ...credentialParams} = modelParams;
    try {
        const modelMessages = await turns.buildModelMessages(service, conversation.id);
        const result = await getAIService(service).call("chatCompletion", client, {
            ...additionalParameters,
            ...credentialParams,
            aiHookId: context.hookId,
            studyId: context.studySession.studyId,
            studySessionId: context.studySession.id,
            studyStepId: context.studyStep.id,
            documentId: context.studyStep.documentId,
            __requestId: requestId,
            messages: modelMessages,
        }, {
            log: {
                aiMessageId: assistantMessage.id,
                input: serviceHelpers.serializeMessages(modelMessages),
            },
        });
        const content = result.choices?.[0]?.message?.content;
        const [updatedCount] = await service.server.db.models["ai_message"].update({
            content: typeof content === "string" ? content : "",
            status: AI_MESSAGE_STATUSES.COMPLETED,
        }, {
            where: {
                id: assistantMessage.id,
                status: AI_MESSAGE_STATUSES.PENDING,
                deleted: false,
            },
        });
        if (updatedCount === 0) {
            throw new Error("AI request was aborted");
        }
        return {
            conversationId: conversation.id,
            userMessage,
            assistantMessage: await service.server.db.models["ai_message"].getById(assistantMessage.id),
        };
    } catch (error) {
        await turns.failAssistantMessage(service, assistantMessage.id);
        throw error;
    }
}

/**
 * Creates or continues a chat conversation with one non-streaming model response.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Message, context values, model, and study identifiers.
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
    const userMetadata = turns.buildQuoteMetadata(context, data?.quote);
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const conversation = data?.conversationId
        ? await loadConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
        )
        : null;
    const modelParams = await getAIService(service).call(
        "resolveHookModel",
        client,
        {hookId: context.hookId, aiModelId: data?.aiModelId},
    );

    const systemMessage = conversation
        ? await service.server.db.models["ai_message"].findOne({
            where: {
                conversationId: conversation.id,
                studyStepId: context.studyStep.id,
                role: AI_MESSAGE_ROLES.SYSTEM,
                deleted: false,
            },
            attributes: ["id"],
            raw: true,
        })
        : null;
    let systemPrompt = null;
    if (!systemMessage) {
        const values = buildPromptValues(context.serviceConfig.inputs, data?.values);
        systemPrompt = (await getAIService(service).call(
            "resolveHookPrompt",
            client,
            {hookId: context.hookId, values},
        )).promptText;
    }

    const turn = await turns.createTurn(
        service,
        context,
        conversation,
        content,
        modelParams,
        systemPrompt,
        userMetadata,
    );
    return runAssistantRequest(
        service,
        client,
        context,
        turn.conversation,
        turn.userMessage,
        turn.assistantMessage,
        modelParams,
        requestId,
    );
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
        throw new Error("AI conversation not found");
    }
    await loadConversation(
        service,
        conversation.id,
        userId,
        conversation.studySessionId,
    );
    const latestAssistant = await turns.getLatestAssistantMessage(service, conversation.id);
    if (Number(latestAssistant?.id) !== assistantMessageId) {
        throw new Error("Only the latest AI response can be retried");
    }

    const context = await loadChatContext(
        service,
        client,
        conversation.studySessionId,
        assistantMessage.studyStepId,
        false,
    );
    const modelParams = await getAIService(service).call(
        "resolveHookModel",
        client,
        {hookId: context.hookId, aiModelId: assistantMessage.aiModelId},
    );

    await service.server.db.sequelize.transaction(async (transaction) => {
        await turns.requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );
        const [updatedCount] = await service.server.db.models["ai_message"].update({
            status: AI_MESSAGE_STATUSES.PENDING,
            content: "",
        }, {
            where: {
                id: assistantMessageId,
                status: {[Op.in]: [AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED]},
                deleted: false,
            },
            transaction,
        });
        if (updatedCount === 0) {
            throw new Error("AI response cannot be retried");
        }
        await service.server.db.models["ai_conversation"].updateById(
            conversation.id,
            {updatedAt: new Date()},
            {transaction},
        );
    });

    return runAssistantRequest(
        service,
        client,
        context,
        conversation,
        null,
        assistantMessage,
        modelParams,
        requestId,
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
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const userId = serviceHelpers.requireClientUserId(client);
    const log = await service.server.db.models["ai_log"].findOne({
        where: {requestId, userId, status: "in_progress", deleted: false},
        raw: true,
    });
    if (!log?.aiMessageId) {
        return {aborted: false, message: "No pending AI request found"};
    }

    const assistantMessage = await service.server.db.models["ai_message"].getById(log.aiMessageId);
    if (!assistantMessage || Number(assistantMessage.role) !== AI_MESSAGE_ROLES.ASSISTANT) {
        return {aborted: false, message: "No pending AI response found"};
    }
    const conversation = await service.server.db.models["ai_conversation"].getById(
        assistantMessage.conversationId,
    );
    if (!conversation) {
        return {aborted: false, message: "AI conversation not found"};
    }
    await loadConversation(
        service,
        conversation.id,
        userId,
        conversation.studySessionId,
    );

    const aborted = await service.server.db.sequelize.transaction(async (transaction) => {
        const [updatedCount] = await service.server.db.models["ai_message"].update({
            status: AI_MESSAGE_STATUSES.ABORTED,
            content: "",
        }, {
            where: {
                id: assistantMessage.id,
                status: AI_MESSAGE_STATUSES.PENDING,
                deleted: false,
            },
            transaction,
        });
        if (updatedCount === 0) return false;
        await getAIService(service).call("cancelRequest", client, {logId: log.id}, {db: {transaction}});
        return true;
    });
    if (!aborted) {
        return {aborted: false, message: "AI request is no longer pending"};
    }

    const result = await getAIService(service).call(
        "abortChatCompletion",
        client,
        {requestId, reason: "request aborted"},
    );
    return {...result, aborted: true};
}

module.exports = {
    getConversation,
    sendConversationMessage,
    retryConversationMessage,
    abortConversationMessage,
    buildModelMessages: turns.buildModelMessages,
};
