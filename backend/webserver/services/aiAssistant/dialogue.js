"use strict";

/**
 * Adaptive or fixed dialogue orchestration.
 *
 * @module webserver/services/aiAssistant/dialogue
 * @author Mohammed Rawhani
 */

const {AI_CONVERSATION_TYPES} = require("../../../db/models/ai_conversation");
const {
    AI_MESSAGE_ROLES,
    AI_MESSAGE_STATUSES,
} = require("../../../db/models/ai_message");
const {stepTypes} = require("../../../db/models/study_step");
const {CONFIGURATION_TYPES} = require("../../../db/models/configuration");
const serviceHelpers = require("../../../utils/helper/ai/helpers.js");
const core = require("./core.js");
const anchors = require("./dialogueAnchors.js");
const dialoguePlan = require("./dialoguePlan.js");
const turns = require("./turns.js");
const {
    buildQuestionMetadata,
    buildAnswerMetadata,
    getCurrentQuestion,
    requireCurrentQuestion,
    countFollowUps,
    getMaxFollowUps,
    buildDecisionValues,
    buildAnchorSources,
    normalizeDialoguePlan,
    parseDialogueDecision,
    renderQuestion,
    selectNextPlanQuestion,
} = dialoguePlan;

const DIALOGUE = {
    conversationType: AI_CONVERSATION_TYPES.DIALOGUE,
    notFoundMessage: "AI dialogue not found",
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
 * Loads a Dialogue conversation and validates ownership.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Expected study session identifier.
 * @param {Object} [options] - Sequelize query options.
 * @returns {Promise<Object>} Owned Dialogue conversation.
 */
async function loadDialogueConversation(service, conversationId, userId, studySessionId, options = {}) {
    return core.loadOwnedConversation(service, conversationId, userId, studySessionId, DIALOGUE, options);
}

/**
 * Finds a configured Dialogue hook service by purpose/name.
 *
 * @param {Object[]} services - Study step service declarations.
 * @param {string} purpose - Expected service purpose.
 * @returns {Object|null} Service declaration.
 */
function findDialogueService(services, purpose) {
    const candidates = services.filter((entry) => entry?.type === "aiDialogue");
    return candidates.find((entry) => entry.purpose === purpose)
        || candidates.find((entry) => String(entry.name || "").toLowerCase().includes(purpose))
        || null;
}

/**
 * Loads the configured dialogue plan JSON.
 *
 * @param {Object} models - Sequelize models registry.
 * @param {Object} studyStep - Study step row.
 * @returns {Promise<Object>} Normalized dialogue plan.
 */
async function loadDialoguePlan(models, studyStep) {
    const settings = studyStep.configuration?.settings || {};
    const inlinePlan = settings.dialoguePlan || studyStep.configuration?.dialoguePlan;
    const configurationId = Number(
        settings.dialoguePlanConfigurationId || settings.configurationId || 0,
    );
    let rawPlan = inlinePlan || null;
    if (!rawPlan && configurationId > 0) {
        const config = await models["configuration"].getById(configurationId);
        if (
            !config ||
            config.deleted ||
            Number(config.type) !== CONFIGURATION_TYPES.DIALOGUE_PLAN
        ) {
            throw new Error("Dialogue plan configuration not found");
        }
        rawPlan = typeof config.content === "string"
            ? JSON.parse(config.content)
            : config.content;
    }
    const plan = normalizeDialoguePlan(rawPlan || {});
    if (!plan.questions.length) {
        throw new Error("Dialogue plan has no questions");
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
 * @returns {Promise<Object>} Dialogue context.
 */
async function loadDialogueContext(
    service,
    client,
    studySessionId,
    studyStepId,
    {requireCurrentStep = true, requireHooks = true} = {},
) {
    const {userId, models, studySession, studyStep} = await core.loadStudyStepContext(
        service,
        client,
        studySessionId,
        studyStepId,
    );
    if (Number(studyStep.stepType) !== stepTypes.STEP_TYPE_DIALOGUE) {
        throw new Error("Study step is not a Dialogue step");
    }
    if (requireCurrentStep && Number(studySession.studyStepId) !== Number(studyStep.id)) {
        throw new Error("Dialogue is only available for the current study step");
    }

    const services = Array.isArray(studyStep.configuration?.services)
        ? studyStep.configuration.services
        : [];
    const decisionService = findDialogueService(services, "decision");
    const contextService = findDialogueService(services, "context")
        || (decisionService ? null : services.find((entry) => entry?.type === "aiDialogue"))
        || null;
    const contextHookId = Number(contextService?.hookId) || null;
    const decisionHookId = Number(decisionService?.hookId) || null;
    if (requireHooks && contextHookId) {
        await core.getAIService(service).call("loadHook", client, {hookId: contextHookId});
    }
    if (requireHooks && decisionHookId) {
        await core.getAIService(service).call("loadHook", client, {hookId: decisionHookId});
    }

    const plan = await loadDialoguePlan(models, studyStep);
    if (requireHooks && plan.adaptive && !decisionHookId) {
        throw new Error("Adaptive Dialogue requires a decision hook");
    }

    return {
        userId,
        studySession,
        studyStep,
        plan,
        contextService,
        decisionService,
        contextHookId,
        decisionHookId,
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
        {requireCurrentStep: false, requireHooks: false},
    );
    const existing = data?.conversationId
        ? await loadDialogueConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
        )
        : await findDialogueConversation(service, context.userId, context.studySession.id);
    const conversations = existing ? [{
        id: existing.id,
        studySessionId: existing.studySessionId,
        type: existing.type,
        title: existing.title,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
    }] : [];
    const messages = existing ? await service.server.db.models["ai_message"].getVisibleMessages(existing.id, context.studyStep.id) : [];
    const currentQuestion = getCurrentQuestion(context.plan, messages);
    const latestAssistant = [...messages].reverse().find((message) => Number(message.role) === AI_MESSAGE_ROLES.ASSISTANT);

    return {
        conversations,
        activeConversationId: existing?.id || null,
        messages,
        plan: {
            title: context.plan.title,
            adaptive: context.plan.adaptive,
            allowSkip: context.plan.allowSkip,
            totalQuestions: context.plan.questions.length,
        },
        currentQuestion,
        complete: Number(latestAssistant?.status) === AI_MESSAGE_STATUSES.COMPLETED
            && latestAssistant?.metadata?.dialogue?.kind === "completion",
    };
}

/**
 * Formats an answer into stored message content.
 *
 * @param {Object} data - Client answer payload.
 * @returns {string} User-visible answer text.
 */
function normalizeAnswerText(data) {
    const raw = data?.content ?? data?.answerText ?? data?.answerValue ?? data?.answer;
    if (raw === null || raw === undefined) return "";
    return String(raw).trim();
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
    if (!context.contextHookId) return {systemPrompt: null, anchorSources: {pr1: [], pr2: []}};
    const promptValues = core.buildPromptValues(context.contextService?.inputs, values);
    const systemPrompt = (await core.getAIService(service).call(
        "resolveHookPrompt",
        client,
        {hookId: context.contextHookId, values: promptValues},
    )).promptText;
    return {systemPrompt, anchorSources: buildAnchorSources(promptValues)};
}

/**
 * Adds the initial system context message when configured.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Dialogue context.
 * @param {Object} currentConversation - Conversation row.
 * @param {string|null} systemPrompt - Resolved system prompt.
 * @param {Object} anchorSources - Student-authored review source snapshot.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<void>}
 */
async function addSystemContextIfNeeded(
    service,
    context,
    currentConversation,
    systemPrompt,
    anchorSources,
    options,
) {
    if (!context.contextHookId) return;
    if (systemPrompt === null) {
        throw new Error("Dialogue context is missing for this study step");
    }
    await service.server.db.models["ai_message"].add({
        conversationId: currentConversation.id,
        studyStepId: context.studyStep.id,
        role: AI_MESSAGE_ROLES.SYSTEM,
        content: systemPrompt,
        metadata: {
            dialogue: {
                kind: "context",
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
 * @param {Object|null} currentConversation - Existing conversation.
 * @param {string|null} systemPrompt - Resolved system prompt.
 * @param {Object} anchorSources - Student-authored review source snapshot.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<Object>} Conversation row.
 */
async function ensureConversation(
    service,
    context,
    currentConversation,
    systemPrompt,
    anchorSources,
    options,
) {
    const row = currentConversation || await service.server.db.models["ai_conversation"].add({
        userId: context.userId,
        studySessionId: context.studySession.id,
        type: AI_CONVERSATION_TYPES.DIALOGUE,
        title: context.plan.title,
    }, options);
    if (!currentConversation) {
        await addSystemContextIfNeeded(service, context, row, systemPrompt, anchorSources, options);
    }
    return row;
}

/**
 * Adds a question message when the UI answered a not-yet-stored first question.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} currentConversation - Conversation row.
 * @param {Object} context - Dialogue context.
 * @param {Object} question - Current question.
 * @param {Object[]} existingMessages - Step history loaded in the transaction.
 * @param {Object} options - Sequelize options.
 * @returns {Promise<void>}
 */
async function addQuestionIfMissing(service, currentConversation, context, question, existingMessages, options) {
    const existing = existingMessages.find((message) =>
        message?.metadata?.dialogue?.kind === "main_question"
        && String(message.metadata.dialogue.questionId) === String(question.id)
    );
    if (existing) return;
    const rendered = renderQuestion(question, "", {});
    await service.server.db.models["ai_message"].add({
        conversationId: currentConversation.id,
        studyStepId: context.studyStep.id,
        role: AI_MESSAGE_ROLES.ASSISTANT,
        content: rendered.text,
        metadata: buildQuestionMetadata("main_question", question, rendered),
        status: AI_MESSAGE_STATUSES.COMPLETED,
    }, options);
}

/**
 * Creates an answer and placeholder for the next assistant message.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} context - Dialogue context.
 * @param {Object|null} currentConversation - Existing conversation.
 * @param {Object} question - Current question.
 * @param {string} answerText - Answer text.
 * @param {*} answerValue - Raw answer value.
 * @param {boolean} skipped - Whether the student skipped the question.
 * @param {string|null} systemPrompt - Resolved system prompt.
 * @param {Object} anchorSources - Student-authored review source snapshot.
 * @returns {Promise<Object>} Conversation, user message, assistant placeholder, and previous messages.
 */
async function createDialogueTurn(
    service,
    context,
    currentConversation,
    question,
    answerText,
    answerValue,
    skipped,
    systemPrompt,
    anchorSources,
) {
    const models = service.server.db.models;
    return service.server.db.sequelize.transaction(async (transaction) => {
        await turns.requireNoPendingMessage(
            service,
            context.userId,
            context.studySession.id,
            {transaction},
        );
        const row = await ensureConversation(
            service,
            context,
            currentConversation,
            systemPrompt,
            anchorSources,
            {transaction},
        );
        const previousMessages = await models["ai_message"].getVisibleMessages(row.id, context.studyStep.id, {transaction});
        const currentQuestion = requireCurrentQuestion(context.plan, previousMessages, question.id);
        await addQuestionIfMissing(service, row, context, currentQuestion, previousMessages, {transaction});
        const turn = await turns.createTurnMessages(service, context, row, {
            user: {content: answerText, metadata: buildAnswerMetadata(currentQuestion, answerValue, skipped)},
            assistant: {metadata: {dialogue: {kind: "pending", questionId: currentQuestion.id}}},
        }, {transaction});
        return {...turn, previousMessages, question: currentQuestion};
    });
}

/**
 * Builds the model request for an adaptive Dialogue decision.
 *
 * @param {string} decisionPrompt - Resolved decision hook prompt.
 * @returns {Promise<Object[]>} LiteLLM-compatible decision messages.
 */
async function buildDecisionModelMessages(decisionPrompt) {
    return [{role: "user", content: decisionPrompt}];
}

/**
 * Prepares an adaptive follow-up or the next configured question.
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated dialogue context.
 * @param {Object} turn - Persisted turn and prior step history.
 * @param {Object} question - Answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Final assistant content, metadata and model id.
 */
async function prepareAdaptiveResponse(service, client, context, turn, question, requestId) {
    const skipped = turn.userMessage.metadata?.dialogue?.skipped === true;
    const followUpsUsed = countFollowUps(turn.previousMessages, question.id);
    const canFollowUp = !skipped && followUpsUsed < getMaxFollowUps(question);
    const nextQuestion = selectNextPlanQuestion(context.plan, [...turn.previousMessages, turn.userMessage]);
    const modelParams = canFollowUp
        ? await core.getAIService(service).call("resolveHookModel", client, {hookId: context.decisionHookId})
        : null;
    const anchorState = nextQuestion ? await anchors.prepareDialogueAnchors(
        service, client, context, turn, modelParams, requestId,
    ) : {};
    if (!canFollowUp) {
        return {...dialoguePlan.buildNextQuestionResponse(context.plan, nextQuestion, anchorState),
            aiModelId: anchorState.aiModelId || null};
    }
    const promptValues = buildDecisionValues(
        question, turn.userMessage.content, {followUpsUsed, canFollowUp, skipped},
    );
    const {promptText} = await core.getAIService(service).call(
        "resolveHookPrompt", client, {hookId: context.decisionHookId, values: promptValues},
    );
    const output = await turns.requestAssistantCompletion(
        service, client, {...context, hookId: context.decisionHookId}, modelParams, requestId,
        await buildDecisionModelMessages(promptText), turn.assistantMessage.id,
    );
    const decision = parseDialogueDecision(output);
    const payload = decision.action === "follow_up" && decision.content
        ? {content: decision.content, metadata: buildQuestionMetadata("follow_up", question, {
            followUpIndex: followUpsUsed + 1,
        })}
        : dialoguePlan.buildNextQuestionResponse(context.plan, nextQuestion, anchorState);
    return {...payload, aiModelId: modelParams.aiModelId};
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
    const requestId = serviceHelpers.requireRequestId(data?.requestId);
    const skipped = data?.skipped === true;
    const answerText = normalizeAnswerText(data);
    if (skipped && !context.plan.allowSkip) {
        throw new Error("This Dialogue does not allow skipping questions");
    }
    if (!skipped && !answerText) {
        throw new Error("Answer content is required");
    }

    const currentConversation = data?.conversationId
        ? await loadDialogueConversation(
            service,
            data.conversationId,
            context.userId,
            context.studySession.id,
        )
        : await findDialogueConversation(service, context.userId, context.studySession.id);
    const messages = currentConversation ? await service.server.db.models["ai_message"].getVisibleMessages(currentConversation.id, context.studyStep.id) : [];
    const question = requireCurrentQuestion(context.plan, messages, data?.questionId);
    const resolvedContext = currentConversation
        ? {systemPrompt: null, anchorSources: {pr1: [], pr2: []}}
        : await resolveDialogueSystemPrompt(service, client, context, data?.values || {});
    const turn = await createDialogueTurn(
        service,
        context,
        currentConversation,
        question,
        answerText,
        skipped ? null : data?.answerValue ?? answerText,
        skipped,
        resolvedContext.systemPrompt,
        resolvedContext.anchorSources,
    );
    return completeDialogueTurn(service, client, context, turn, turn.question, requestId);
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
    const {assistantMessageId, requestId, assistantMessage, userId, conversation: currentConversation} =
        await turns.loadRetryableAssistantMessage(service, client, data, DIALOGUE);
    const context = await loadDialogueContext(
        service,
        client,
        currentConversation.studySessionId,
        assistantMessage.studyStepId,
        {requireCurrentStep: false},
    );
    const previousUser = await service.server.db.models["ai_message"].getPreviousUserMessage(assistantMessage);
    const question = context.plan.questions.find((entry) =>
        String(entry.id) === String(previousUser?.metadata?.dialogue?.questionId)
    );
    if (!previousUser || !question) {
        throw new Error("AI response cannot be retried");
    }
    await turns.resetMessageForRetry(
        service,
        userId,
        currentConversation.studySessionId,
        currentConversation.id,
        assistantMessageId,
    );
    const completed = await turns.completeTurn(service, {assistantMessage}, async () => {
        const previousMessages = (await service.server.db.models["ai_message"].getVisibleMessages(
            currentConversation.id, context.studyStep.id,
        )).filter((message) => Number(message.id) < Number(previousUser.id));
        const turn = {conversation: currentConversation, userMessage: previousUser, assistantMessage, previousMessages};
        const currentQuestion = requireCurrentQuestion(context.plan, previousMessages, question.id);
        return prepareDialogueResponse(service, client, context, turn, currentQuestion, requestId);
    });
    return buildDialogueResult(
        service, context, {conversation: currentConversation, userMessage: null}, completed,
    );
}

/**
 * Selects fixed or adaptive response preparation without writing a partial result.
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated dialogue context.
 * @param {Object} turn - Persisted turn and prior history.
 * @param {Object} question - Answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Final response fields.
 */
async function prepareDialogueResponse(service, client, context, turn, question, requestId) {
    if (context.plan.adaptive) {
        return prepareAdaptiveResponse(service, client, context, turn, question, requestId);
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
 * @param {Object} question - Answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Completed dialogue result.
 */
async function completeDialogueTurn(service, client, context, turn, question, requestId) {
    const assistantMessage = await turns.completeTurn(service, turn, () =>
        prepareDialogueResponse(service, client, context, turn, question, requestId),
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
        complete: assistantMessage.metadata?.dialogue?.kind === "completion",
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
    buildDecisionModelMessages,
};
