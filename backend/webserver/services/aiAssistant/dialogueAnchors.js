"use strict";

/**
 * Verified-anchor selection for Dialogue questions.
 *
 * Isolates the source-scoped anchor sub-feature (choosing a student-written
 * review statement per anchored question) from the generic Dialogue flow.
 *
 * @module webserver/services/aiAssistant/dialogueAnchors
 * @author Mohammed Rawhani
 */

const turns = require("./turns.js");
const {DIALOGUE_MODEL_PARAMETERS, DIALOGUE_SOURCES, parseAnchorSelections} = require("./dialoguePlan.js");

/**
 * Builds the backend-owned source-scoped anchor-preparation request.
 *
 * @param {Object} plan - Normalized Dialogue plan.
 * @param {Object} anchorSources - Student-authored review source snapshot.
 * @returns {{questions: Object[], values: Object}} Prepared questions and anchor hook values.
 */
function buildAnchorPreparationRequest(plan, anchorSources = {}) {
    const questions = plan.questions.filter((question) => question.anchoredText).map((question) => ({
        id: question.id,
        categoryId: question.categoryId,
        source: question.source,
        questionText: question.text,
        evidenceGoal: question.evidenceGoal,
        candidates: (anchorSources[question.source] || []).map((text, index) => ({index, text})),
    })).filter((question) => question.candidates.length);
    return {questions, values: {"dialogueAnchors[1]": JSON.stringify(questions)}};
}

/**
 * Loads the review-source and prepared-anchor state stored with the system context.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {number} conversationId - Dialogue conversation identifier.
 * @param {number} studyStepId - Dialogue step id.
 * @returns {Promise<Object>} Stored system message and anchor state.
 */
async function loadAnchorState(service, conversationId, studyStepId) {
    const message = await service.server.db.models["ai_message"].getSystemMessage(conversationId, studyStepId);
    const dialogue = message?.metadata?.dialogue || {};
    return {
        message,
        anchorSources: dialogue.anchorSources || {[DIALOGUE_SOURCES.REVIEW]: []},
        anchorSelections: dialogue.anchorSelections || {},
        prepared: Object.hasOwn(dialogue, "anchorSelections"),
    };
}

/**
 * Selects and stores verified anchors once for a Dialogue conversation.
 *
 * Invalid model output falls back to the unanchored question and is marked as not valid.
 *
 * @param {Object} service - AIAssistantService runtime.
 * @param {Object} client - Authenticated service client.
 * @param {Object} context - Dialogue context.
 * @param {Object} turn - Created Dialogue turn.
 * @param {string} requestId - Request identifier used for logging and abort.
 * @returns {Promise<Object>} Prepared anchor state.
 */
async function prepareDialogueAnchors(service, client, context, turn, requestId) {
    const state = await loadAnchorState(service, turn.conversation.id, context.studyStep.id);
    if (state.prepared) return state;

    const request = buildAnchorPreparationRequest(context.plan, state.anchorSources);
    let anchorSelections = {};
    let anchorsValid = null; // null when no question needed an anchor call
    let aiModelId = null;
    if (request.questions.length) {
        const completion = await turns.requestHookCompletion(
            service, client, context, {
                hookId: context.anchorHookId,
                values: request.values,
                requestId,
                aiMessageId: turn.assistantMessage.id,
                parameters: DIALOGUE_MODEL_PARAMETERS,
            },
        );
        const parsed = parseAnchorSelections(completion.output, context.plan.questions, state.anchorSources);
        anchorsValid = request.questions.every((question) => Object.hasOwn(parsed, question.id));
        anchorSelections = Object.fromEntries(request.questions.map((question) =>
            [question.id, parsed[question.id] ?? null]));
        aiModelId = completion.aiModelId;
    }

    if (state.message) {
        await service.server.db.models["ai_message"].updateById(state.message.id, {
            metadata: {
                ...state.message.metadata,
                dialogue: {
                    ...state.message.metadata?.dialogue,
                    anchorSelections,
                    anchorsValid,
                },
            },
        });
    }
    return {...state, anchorSelections, prepared: true, aiModelId};
}

module.exports = {
    buildAnchorPreparationRequest,
    prepareDialogueAnchors,
};
