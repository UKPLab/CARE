"use strict";

/**
 * Validated study context and prompt inputs shared by AI assistant workflows.
 * @module webserver/services/aiAssistant/core
 * @author Mohammed Rawhani
 */

const TranslatableError = require("../../../utils/TranslatableError");

const serviceHelpers = require("../../../utils/helper/ai/helpers.js");

/**
 * Loads and ownership-checks the study session and step behind an assistant call.
 *
 * Holds the validation identical to every conversation type; callers add their
 * own step-type and current-step checks on top.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {number} studySessionId - Study session identifier.
 * @param {number} studyStepId - Study step identifier.
 * @param {Object} [options] - Validation options.
 * @param {boolean} [options.requireOpen=false] - Reject finished sessions and closed or expired studies.
 * @returns {Promise<Object>} Validated user, models, session, and step.
 */
async function loadStudyStepContext(service, client, studySessionId, studyStepId, {requireOpen = false} = {}) {
    const userId = serviceHelpers.requireClientUserId(client);
    const models = service.server.db.models;
    const sessionId = serviceHelpers.requireId(studySessionId, "studySessionId");
    const stepId = serviceHelpers.requireId(studyStepId, "studyStepId");
    const studySession = await models["study_session"].getById(sessionId);
    if (!studySession || Number(studySession.userId) !== userId) {
        throw new TranslatableError("errors.ai.sessionAccessDenied");
    }
    const studyStep = await models["study_step"].getById(stepId);
    if (!studyStep || Number(studyStep.studyId) !== Number(studySession.studyId)) {
        throw new TranslatableError("errors.ai.assistant.stepNotInSession");
    }
    if (requireOpen) {
        if (studySession.end) {
            throw new TranslatableError("errors.studies.studySession.alreadyFinished");
        }
        await models["study"].checkStudyOpen(studySession.studyId);
    }
    return {userId, models, studySession, studyStep};
}

/**
 * Loads a conversation and validates it is owned by the caller and of the expected type.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Conversation identifier.
 * @param {number} userId - Authenticated user identifier.
 * @param {number} studySessionId - Expected study session identifier.
 * @param {Object} descriptor - Conversation-type descriptor.
 * @param {number} descriptor.conversationType - Expected `ai_conversation.type`.
 * @param {string} descriptor.notFoundKey - Translation key used when validation fails.
 * @param {Object} [options] - Sequelize query options.
 * @returns {Promise<Object>} Owned conversation row.
 */
async function loadOwnedConversation(service, conversationId, userId, studySessionId, descriptor, options = {}) {
    const conversation = await service.server.db.models["ai_conversation"].getOwnedConversation(
        serviceHelpers.requireId(conversationId, "conversationId"),
        userId, studySessionId, descriptor.conversationType, options,
    );
    if (!conversation) {
        throw new TranslatableError(descriptor.notFoundKey);
    }
    return conversation;
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
        throw new TranslatableError("errors.ai.serviceUnavailable");
    }
    return aiService;
}

/**
 * Builds trusted prompt values from the stored mapping and caller-resolved content.
 *
 * @param {Object} inputMappings - Stored input mappings.
 * @param {Object} suppliedValues - Values resolved by the frontend.
 * @returns {Object} Values safe to pass to the hook resolver.
 */
function buildPromptValues(inputMappings, suppliedValues) {
    const mappings = inputMappings && typeof inputMappings === "object" ? inputMappings : {};
    const supplied = suppliedValues && typeof suppliedValues === "object" ? suppliedValues : {};
    const values = {};

    for (const [key, mapping] of Object.entries(mappings)) {
        if (!Object.prototype.hasOwnProperty.call(supplied, key)) {
            throw new TranslatableError("errors.ai.assistant.inputMissing", {key});
        }
        if (mapping?.type === "configuration") {
            values[key] = {type: "serviceReplacement", input: mapping};
            continue;
        }
        if (mapping?.type === "submission") {
            const suppliedInput = supplied[key]?.input || {};
            values[key] = {
                type: "serviceReplacement",
                input: {
                    ...mapping,
                    submissionId: mapping.submissionId ?? null,
                    pdfText: suppliedInput.pdfText ?? null,
                },
            };
            continue;
        }
        // File references are built above from stored mappings only; client ones could point at any submission.
        if (supplied[key]?.type === "serviceReplacement") {
            throw new TranslatableError("errors.ai.assistant.inputInvalid", {key});
        }
        values[key] = supplied[key];
    }
    return values;
}

module.exports = {
    loadStudyStepContext,
    loadOwnedConversation,
    getAIService,
    buildPromptValues,
};
