"use strict";

/**
 * Adaptive or fixed Dialogue orchestration.
 *
 * Fixed-plan support is extensible groundwork; final support needs a plan, UI updates, and validation.
 *
 * @module webserver/services/aiAssistant/dialogue
 * @author Mohammed Rawhani
 */

const TranslatableError = require("../../../utils/TranslatableError");

const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const {
    AI_MESSAGE_ROLES,
    AI_MESSAGE_STATUSES,
} = require("../../../db/models/ai_message");
const helpers = require("../../../utils/helper/ai/helpers.js");
const core = require("./core.js");
const dialogueAdaptive = require("./dialogueAdaptive.js");
const dialoguePlan = require("./dialoguePlan.js");
const turns = require("./turns.js");
const {
    DIALOGUE_SOURCES,
    DIALOGUE_MESSAGE_KINDS,
    buildAnswerMetadata,
    buildQuestionMetadata,
    getCurrentQuestion,
    requireCurrentQuestion,
    buildAnchorSources,
    normalizeDialoguePlan,
    renderQuestion,
    selectNextPlanQuestion,
} = dialoguePlan;

const DIALOGUE = {
    conversationType: AI_CONVERSATION_TYPES.DIALOGUE,
    notFoundKey: "errors.ai.dialogue.notFound",
};

const DIALOGUE_SERVICES = {
    context: "dialogueContext",
    decision: "dialogueDecision",
    anchor: "dialogueAnchor",
};

/**
 * Finds the latest Dialogue conversation in a study session.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Study session identifier.
 * @returns {Promise<Object|null>} Existing conversation, if any.
 */
async function findDialogueConversation(service, userId, studySessionId) {
    const rows = await service.server.db.models["ai_conversation"].getSessionConversations(
        userId, studySessionId, AI_CONVERSATION_TYPES.DIALOGUE,
    );
    return rows[0] || null;
}

/**
 * Finds a configured Dialogue hook service by its workflow service name.
 *
 * @param {Object[]} services - Study step service declarations.
 * @param {string} name - Workflow service name.
 * @returns {Object|null} Service declaration.
 */
function findDialogueService(services, name) {
    return services.find((entry) => entry?.type === "aiDialogue" && entry.name === name) || null;
}

/**
 * Loads the configured dialogue plan JSON.
 *
 * @param {Object} models - Sequelize models registry.
 * @param {Object} studyStep - Study step row.
 * @returns {Promise<Object>} Normalized dialogue plan.
 */
async function loadDialoguePlan(models, studyStep) {
    const configurationId = Number(studyStep.configuration?.settings?.dialoguePlanConfigurationId) || 0;
    const config = configurationId ? await models["configuration"].getById(configurationId) : null;
    // 2 = Dialogue plan configuration.
    if (!config || config.deleted || Number(config.type) !== 2) {
        throw new TranslatableError("errors.ai.dialogue.planNotFound");
    }
    const plan = normalizeDialoguePlan(config.content);
    if (!plan.questions.length) {
        throw new TranslatableError("errors.ai.dialogue.planEmpty");
    }
    return plan;
}

/**
 * Loads and validates the authenticated Dialogue context.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {number} studySessionId - Study session identifier.
 * @param {number} studyStepId - Study step identifier.
 * @param {Object} [options] - Context validation options.
 * @param {boolean} [options.requireCurrentStep=true] - Whether the step must be current.
 * @param {boolean} [options.requireHooks=true] - Whether execution hooks must be available.
 * @param {boolean} [options.requireOpen=true] - Whether the session and study must still be open.
 * @returns {Promise<Object>} Dialogue context.
 */
async function loadDialogueContext(
    service,
    client,
    studySessionId,
    studyStepId,
    {requireCurrentStep = true, requireHooks = true, requireOpen = true} = {},
) {
    const {userId, models, studySession, studyStep} = await core.loadStudyStepContext(
        service,
        client,
        studySessionId,
        studyStepId,
        {requireOpen},
    );
    if (Number(studyStep.stepType) !== models["study_step"].stepTypes.STEP_TYPE_DIALOGUE) {
        throw new TranslatableError("errors.ai.dialogue.wrongStepType");
    }
    if (requireCurrentStep && Number(studySession.studyStepId) !== Number(studyStep.id)) {
        throw new TranslatableError("errors.ai.dialogue.currentStepOnly");
    }

    const services = Array.isArray(studyStep.configuration?.services)
        ? studyStep.configuration.services
        : [];
    const contextService = findDialogueService(services, DIALOGUE_SERVICES.context);
    const decisionService = findDialogueService(services, DIALOGUE_SERVICES.decision);
    const anchorService = findDialogueService(services, DIALOGUE_SERVICES.anchor);
    const contextHookId = Number(contextService?.hookId) || null;
    const decisionHookId = Number(decisionService?.hookId) || null;
    const anchorHookId = Number(anchorService?.hookId) || null;
    if (requireHooks) {
        for (const hookId of [contextHookId, decisionHookId, anchorHookId].filter(Boolean)) {
            await core.getAIService(service).call("loadHook", client, {hookId});
        }
    }

    const plan = await loadDialoguePlan(models, studyStep);
    if (requireHooks && plan.adaptive && !decisionHookId) {
        throw new TranslatableError("errors.ai.dialogue.decisionHookRequired");
    }
    if (requireHooks && plan.adaptive && !anchorHookId && plan.questions.some((question) => question.anchoredText)) {
        throw new TranslatableError("errors.ai.dialogue.anchorHookRequired");
    }

    return {
        userId,
        studySession,
        studyStep,
        plan,
        contextService,
        contextHookId,
        decisionHookId,
        anchorHookId,
    };
}

/**
 * Loads the Dialogue snapshot for the current step.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Session, step, and optional conversation identifiers.
 * @returns {Promise<Object>} Dialogue snapshot.
 */
async function getDialogueConversation(service, client, data) {
    const context = await loadDialogueContext(
        service,
        client,
        data?.studySessionId,
        data?.studyStepId,
        {requireCurrentStep: false, requireHooks: false, requireOpen: false},
    );
    const conversation = data?.conversationId
        ? await core.loadOwnedConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
            DIALOGUE,
        )
        : await findDialogueConversation(service, context.userId, context.studySession.id);
    const messages = conversation ? await service.server.db.models["ai_message"].getVisibleMessages(conversation.id, context.studyStep.id) : [];
    const currentQuestion = getCurrentQuestion(context.plan, messages);
    const latestAssistant = [...messages].reverse().find((message) => Number(message.role) === AI_MESSAGE_ROLES.ASSISTANT);

    return {
        activeConversationId: conversation?.id || null,
        messages,
        plan: {
            title: context.plan.title,
            allowSkip: context.plan.allowSkip,
            totalQuestions: context.plan.questions.length,
        },
        currentQuestion,
        complete: Number(latestAssistant?.status) === AI_MESSAGE_STATUSES.COMPLETED
            && latestAssistant?.metadata?.dialogue?.kind === DIALOGUE_MESSAGE_KINDS.COMPLETION,
    };
}

/**
 * Resolves the initial system context prompt before opening the DB transaction.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Dialogue context.
 * @param {Object} values - Hook input values resolved by the frontend.
 * @returns {Promise<Object>} Resolved prompt and anchor-source snapshot.
 */
async function resolveDialogueSystemPrompt(service, client, context, values) {
    if (!context.contextHookId) return {systemPrompt: null, anchorSources: {[DIALOGUE_SOURCES.REVIEW]: []}};
    const promptValues = core.buildPromptValues(context.contextService?.inputs, values);
    const systemPrompt = (await core.getAIService(service).call(
        "resolveHookPrompt",
        client,
        {hookId: context.contextHookId, values: promptValues},
    )).promptText;
    return {
        systemPrompt,
        anchorSources: buildAnchorSources(context.contextService?.inputs, promptValues),
    };
}

/**
 * Adds the initial system context message when configured.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Dialogue context.
 * @param {Object} conversation - Conversation row.
 * @param {Object} resolvedContext - Prepared initial context.
 * @param {string|null} resolvedContext.systemPrompt - Resolved system prompt.
 * @param {Object} resolvedContext.anchorSources - Review source snapshot.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<void>}
 */
async function addSystemContextIfNeeded(
    service,
    context,
    conversation,
    resolvedContext,
    options,
) {
    const {systemPrompt, anchorSources} = resolvedContext;
    if (!context.contextHookId) return;
    if (systemPrompt === null) {
        throw new TranslatableError("errors.ai.dialogue.contextMissing");
    }
    await service.server.db.models["ai_message"].add({
        conversationId: conversation.id,
        studyStepId: context.studyStep.id,
        role: AI_MESSAGE_ROLES.SYSTEM,
        content: systemPrompt,
        metadata: {
            dialogue: {
                kind: DIALOGUE_MESSAGE_KINDS.CONTEXT,
                planVersion: context.plan.version,
                anchorSources,
            },
        },
        status: AI_MESSAGE_STATUSES.COMPLETED,
    }, options);
}

/**
 * Creates the conversation if this is the first Dialogue answer.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Dialogue context.
 * @param {Object|null} existingConversation - Existing conversation.
 * @param {Object} resolvedContext - Prepared initial context.
 * @param {string|null} resolvedContext.systemPrompt - Resolved system prompt.
 * @param {Object} resolvedContext.anchorSources - Review source snapshot.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<Object>} Conversation record.
 */
async function ensureConversation(
    service,
    context,
    existingConversation,
    resolvedContext,
    options,
) {
    const conversation = existingConversation || await service.server.db.models["ai_conversation"].add({
        userId: context.userId,
        studySessionId: context.studySession.id,
        type: AI_CONVERSATION_TYPES.DIALOGUE,
        title: context.plan.title,
    }, options);
    if (!existingConversation) {
        await addSystemContextIfNeeded(service, context, conversation, resolvedContext, options);
    }
    return conversation;
}

/**
 * Adds a question message when the UI answered a not-yet-stored first question.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} conversation - Conversation row.
 * @param {Object} context - Dialogue context.
 * @param {Object} question - Current question.
 * @param {Object[]} existingMessages - Step history loaded in the transaction.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<void>}
 */
async function addQuestionIfMissing(service, conversation, context, question, existingMessages, options) {
    const existing = existingMessages.find((message) =>
        message?.metadata?.dialogue?.kind === DIALOGUE_MESSAGE_KINDS.MAIN_QUESTION
        && String(message.metadata.dialogue.questionId) === String(question.id)
    );
    if (existing) return;
    const rendered = renderQuestion(question, "", {});
    await service.server.db.models["ai_message"].add({
        conversationId: conversation.id,
        studyStepId: context.studyStep.id,
        role: AI_MESSAGE_ROLES.ASSISTANT,
        content: rendered.text,
        metadata: buildQuestionMetadata(DIALOGUE_MESSAGE_KINDS.MAIN_QUESTION, question, rendered),
        status: AI_MESSAGE_STATUSES.COMPLETED,
    }, options);
}

/**
 * Creates an answer and placeholder for the next assistant message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Dialogue context.
 * @param {Object|null} existingConversation - Existing conversation.
 * @param {Object} data - Prepared turn data.
 * @param {Object} data.question - Current question.
 * @param {Object} data.answer - Validated answer data.
 * @param {string} data.answer.answerText - Answer text.
 * @param {*} data.answer.answerValue - Raw answer value.
 * @param {boolean} data.answer.skipped - Whether the question was skipped.
 * @param {Object} data.resolvedContext - Prepared initial context.
 * @param {string|null} data.resolvedContext.systemPrompt - Resolved system prompt.
 * @param {Object} data.resolvedContext.anchorSources - Review source snapshot.
 * @param {string} data.requestId - Request that owns the assistant placeholder.
 * @returns {Promise<Object>} Conversation, user message, assistant placeholder, and previous messages.
 */
async function createDialogueTurn(service, context, existingConversation, data) {
    const {question, answer, resolvedContext, requestId} = data;
    const {answerText, answerValue, skipped} = answer;
    const models = service.server.db.models;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await turns.requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );
        const conversation = await ensureConversation(
            service,
            context,
            existingConversation,
            resolvedContext,
            {transaction},
        );
        const previousMessages = await models["ai_message"].getVisibleMessages(conversation.id, context.studyStep.id, {transaction});
        const currentQuestion = requireCurrentQuestion(context.plan, previousMessages, question.id);
        await addQuestionIfMissing(service, conversation, context, currentQuestion, previousMessages, {transaction});
        const turn = await turns.createTurnMessages(service, context, conversation, {
            requestId,
            user: {content: answerText, metadata: buildAnswerMetadata(currentQuestion, answerValue, skipped)},
            assistant: {metadata: {dialogue: {kind: DIALOGUE_MESSAGE_KINDS.PENDING, questionId: currentQuestion.id}}},
        }, {transaction});
        return {...turn, previousMessages, question: currentQuestion};
    });
}

/**
 * Stores one Dialogue answer and returns the next question or completion message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Dialogue answer payload.
 * @returns {Promise<Object>} Completed dialogue turn.
 */
async function sendDialogueAnswer(service, client, data) {
    const context = await loadDialogueContext(
        service,
        client,
        data?.studySessionId,
        data?.studyStepId,
    );
    const requestId = helpers.requireRequestId(data?.requestId);
    const skipped = data?.skipped === true;
    const answerText = String(data?.answerText ?? "").trim();
    if (skipped && !context.plan.allowSkip) {
        throw new TranslatableError("errors.ai.dialogue.skipNotAllowed");
    }
    if (!skipped && !answerText) {
        throw new TranslatableError("errors.ai.dialogue.answerRequired");
    }

    const conversation = data?.conversationId
        ? await core.loadOwnedConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
            DIALOGUE,
        )
        : await findDialogueConversation(service, context.userId, context.studySession.id);
    const messages = conversation ? await service.server.db.models["ai_message"].getVisibleMessages(conversation.id, context.studyStep.id) : [];
    const question = requireCurrentQuestion(context.plan, messages, data?.questionId);
    const resolvedContext = conversation
        ? {systemPrompt: null, anchorSources: {[DIALOGUE_SOURCES.REVIEW]: []}}
        : await resolveDialogueSystemPrompt(service, client, context, data?.values || {});
    const turn = await createDialogueTurn(
        service,
        context,
        conversation,
        {
            question,
            answer: {answerText, answerValue: skipped ? null : data?.answerValue ?? answerText, skipped},
            resolvedContext,
            requestId,
        },
    );
    return completeDialogueTurn(service, client, context, turn, requestId);
}

/**
 * Retries one failed or aborted Dialogue response.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Retry payload.
 * @returns {Promise<Object>} Completed assistant response.
 */
async function retryDialogueMessage(service, client, data) {
    const {assistantMessageId, requestId, assistantMessage, userId, conversation} =
        await turns.loadRetryableAssistantMessage(service, client, data, DIALOGUE);
    const context = await loadDialogueContext(
        service,
        client,
        conversation.studySessionId,
        assistantMessage.studyStepId,
        {requireCurrentStep: false},
    );
    const previousUser = await service.server.db.models["ai_message"].getPreviousUserMessage(assistantMessage);
    const question = context.plan.questions.find((entry) =>
        String(entry.id) === String(previousUser?.metadata?.dialogue?.questionId)
    );
    if (!previousUser || !question) {
        throw new TranslatableError("errors.ai.assistant.retryNotAllowed");
    }
    await turns.resetMessageForRetry(
        service,
        userId,
        conversation.studySessionId,
        conversation.id,
        assistantMessageId,
        requestId,
    );
    const completed = await turns.completeTurn(service, {assistantMessage}, requestId, async () => {
        const previousMessages = (await service.server.db.models["ai_message"].getVisibleMessages(
            conversation.id, context.studyStep.id,
        )).filter((message) => Number(message.id) < Number(previousUser.id));
        const currentQuestion = requireCurrentQuestion(context.plan, previousMessages, question.id);
        const turn = {
            conversation, userMessage: previousUser, assistantMessage,
            previousMessages, question: currentQuestion,
        };
        return prepareDialogueResponse(service, client, context, turn, requestId);
    });
    return buildDialogueResult(
        service, context, {conversation, userMessage: null}, completed,
    );
}

/**
 * Selects fixed or adaptive response preparation without writing a partial result.
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated dialogue context.
 * @param {Object} turn - Persisted turn and prior history.
 * @param {Object} turn.question - Validated answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Final response fields.
 */
async function prepareDialogueResponse(service, client, context, turn, requestId) {
    if (context.plan.adaptive) {
        return dialogueAdaptive.prepareResponse(service, client, context, turn, requestId);
    }
    const nextQuestion = selectNextPlanQuestion(context.plan, [...turn.previousMessages, turn.userMessage]);
    return dialoguePlan.buildNextQuestionResponse(context.plan, nextQuestion);
}

/**
 * Completes a newly stored dialogue turn with shared failure cleanup.
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated dialogue context.
 * @param {Object} turn - Persisted turn and prior history.
 * @param {Object} turn.question - Validated answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Completed dialogue result.
 */
async function completeDialogueTurn(service, client, context, turn, requestId) {
    const assistantMessage = await turns.completeTurn(service, turn, requestId, () =>
        prepareDialogueResponse(service, client, context, turn, requestId),
    );
    return buildDialogueResult(service, context, turn, assistantMessage);
}

/**
 * Builds the visible state after a completed dialogue turn.
 * @param {Object} service - Assistant service.
 * @param {Object} context - Validated dialogue context.
 * @param {Object} turn - Persisted turn.
 * @param {Object} assistantMessage - Completed assistant row.
 * @returns {Promise<Object>} Shared turn fields and dialogue progress.
 */
async function buildDialogueResult(service, context, turn, assistantMessage) {
    const result = await turns.buildTurnResult(service, turn, assistantMessage);
    const messages = await service.server.db.models["ai_message"].getVisibleMessages(
        turn.conversation.id, context.studyStep.id,
    );
    return {
        ...result, messages,
        currentQuestion: getCurrentQuestion(context.plan, messages),
        complete: assistantMessage.metadata?.dialogue?.kind === DIALOGUE_MESSAGE_KINDS.COMPLETION,
    };
}

/**
 * Aborts the authenticated user's pending Dialogue response.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} data - Request identifier.
 * @returns {Promise<Object>} Abort result.
 */
async function abortDialogueMessage(service, client, data) {
    return turns.abortPendingMessage(service, client, data, DIALOGUE);
}

module.exports = {
    getDialogueConversation,
    sendDialogueAnswer,
    retryDialogueMessage,
    abortDialogueMessage,
};
