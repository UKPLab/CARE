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

const VISIBLE_MESSAGE_ROLES = [AI_MESSAGE_ROLES.USER, AI_MESSAGE_ROLES.ASSISTANT];
const MODEL_ROLES = {
    [AI_MESSAGE_ROLES.SYSTEM]: "system",
    [AI_MESSAGE_ROLES.USER]: "user",
    [AI_MESSAGE_ROLES.ASSISTANT]: "assistant",
};

/**
 * Validates the RPC client's numeric `userId`.
 *
 * @param {{ userId?: number }} client Incoming RPC invocation context.
 * @returns {number} Authenticated user id.
 */
function requireClientUserId(client) {
    const id = Number(client?.userId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid user context");
    }
    return id;
}

/**
 * Serializes the exact OpenAI-compatible messages sent to the model.
 *
 * @param {unknown} messages Serialized chat history.
 * @returns {string|null}
 */
function serializeMessages(messages) {
    return Array.isArray(messages) && messages.length ? JSON.stringify(messages) : null;
}

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
 * Returns a positive integer or throws a request error.
 *
 * @param {unknown} value - Candidate identifier.
 * @param {string} name - Field name used in the error.
 * @returns {number} Valid identifier.
 */
function requireId(value, name) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Missing or invalid ${name}`);
    }
    return id;
}

/**
 * Returns a non-empty request identifier.
 *
 * @param {unknown} value - Candidate request identifier.
 * @returns {string} Normalized request identifier.
 */
function requireRequestId(value) {
    const requestId = typeof value === "string" ? value.trim() : "";
    if (!requestId) {
        throw new Error("Missing requestId");
    }
    return requestId;
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
    const userId = requireClientUserId(client);
    const models = service.server.db.models;
    const sessionId = requireId(studySessionId, "studySessionId");
    const stepId = requireId(studyStepId, "studyStepId");
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
        requireId(conversationId, "conversationId"),
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
            role: {[Op.in]: VISIBLE_MESSAGE_ROLES},
            deleted: false,
        },
        attributes: [
            "id",
            "conversationId",
            "studyStepId",
            "aiModelId",
            "role",
            "content",
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
async function getIntroducedStepIds(service, conversationId) {
    const messages = await service.server.db.models["ai_message"].findAll({
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
    return [...new Set(messages.map((message) => Number(message.studyStepId)).filter(Boolean))];
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
        attributes: ["id", "studySessionId", "type", "createdAt", "updatedAt"],
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        raw: true,
    });

    const requestedConversationId = data?.conversationId
        ? requireId(data.conversationId, "conversationId")
        : null;
    const activeConversation = requestedConversationId
        ? await loadConversation(
            service,
            requestedConversationId,
            context.userId,
            context.studySession.id,
        )
        : conversations[0] || null;
    const models = await getHookModels(service, client, context.hookId);

    return {
        conversations,
        activeConversationId: activeConversation?.id || null,
        messages: activeConversation ? await getVisibleMessages(service, activeConversation.id) : [],
        introducedStepIds: activeConversation
            ? await getIntroducedStepIds(service, activeConversation.id)
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
 * Creates one user turn and its pending assistant placeholder atomically.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Validated chat context.
 * @param {Object|null} conversation - Existing conversation, or null for a new one.
 * @param {string} content - User message content.
 * @param {Object} modelParams - Resolved hook model parameters.
 * @param {string|null} systemPrompt - System context needed for this step.
 * @returns {Promise<Object>} Conversation, user message, and assistant placeholder.
 */
async function createTurn(service, context, conversation, content, modelParams, systemPrompt) {
    const models = service.server.db.models;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );

        let currentConversation = conversation;
        if (currentConversation) {
            currentConversation = await loadConversation(
                service,
                currentConversation.id,
                context.userId,
                context.studySession.id,
                {transaction},
            );
            const latestAssistant = await getLatestAssistantMessage(
                service,
                currentConversation.id,
                {transaction},
            );
            if (
                latestAssistant &&
                [AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED]
                    .includes(Number(latestAssistant.status))
            ) {
                throw new Error("Retry the previous AI response before sending another message");
            }
        } else {
            currentConversation = await models["ai_conversation"].add({
                userId: context.userId,
                studySessionId: context.studySession.id,
                type: AI_CONVERSATION_TYPES.CHAT,
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
            content,
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
        const messages = await buildModelMessages(service, conversation.id);
        const result = await getAIService(service).call("chatCompletion", client, {
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
            log: {
                aiMessageId: assistantMessage.id,
                input: serializeMessages(messages),
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
        await failAssistantMessage(service, assistantMessage.id);
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
    const requestId = requireRequestId(data?.requestId);
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

    const turn = await createTurn(
        service,
        context,
        conversation,
        content,
        modelParams,
        systemPrompt,
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
    const assistantMessageId = requireId(data?.assistantMessageId, "assistantMessageId");
    const requestId = requireRequestId(data?.requestId);
    const assistantMessage = await service.server.db.models["ai_message"].getById(assistantMessageId);
    if (
        !assistantMessage ||
        Number(assistantMessage.role) !== AI_MESSAGE_ROLES.ASSISTANT ||
        ![AI_MESSAGE_STATUSES.FAILED, AI_MESSAGE_STATUSES.ABORTED]
            .includes(Number(assistantMessage.status))
    ) {
        throw new Error("AI response cannot be retried");
    }

    const userId = requireClientUserId(client);
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
    const latestAssistant = await getLatestAssistantMessage(service, conversation.id);
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
        await requireNoPendingMessage(
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
    const requestId = requireRequestId(data?.requestId);
    const userId = requireClientUserId(client);
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
    buildModelMessages,
};
