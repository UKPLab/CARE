"use strict";

/**
 * Adaptive Dialogue response preparation.
 *
 * @module webserver/services/aiAssistant/dialogueAdaptive
 * @author Mohammed Rawhani
 */

const anchors = require("./dialogueAnchors.js");
const dialoguePlan = require("./dialoguePlan.js");
const turns = require("./turns.js");

/**
 * Prepares an adaptive follow-up or the next configured question.
 *
 * @param {Object} service - Assistant service.
 * @param {Object} client - Authenticated client.
 * @param {Object} context - Validated Dialogue context.
 * @param {Object} turn - Persisted turn and prior step history.
 * @param {Object} turn.question - Validated answered question.
 * @param {string} requestId - Request identifier.
 * @returns {Promise<Object>} Final assistant content, metadata, and model id.
 */
async function prepareResponse(service, client, context, turn, requestId) {
    const {question} = turn;
    const skipped = turn.userMessage.metadata?.dialogue?.skipped === true;
    const followUpsUsed = dialoguePlan.countFollowUps(turn.previousMessages, question.id);
    const canFollowUp = !skipped && followUpsUsed < question.maxFollowUps;
    const nextQuestion = dialoguePlan.selectNextPlanQuestion(
        context.plan,
        [...turn.previousMessages, turn.userMessage],
    );
    const anchorState = !nextQuestion
    ? {}
    : skipped
        ? await anchors.loadAnchorState(
            service,
            turn.conversation.id,
            context.studyStep.id,
        )
        : await anchors.prepareDialogueAnchors(
            service, client, context, turn, requestId,
        );
    if (!canFollowUp) {
        const payload = dialoguePlan.buildNextQuestionResponse(context.plan, nextQuestion, anchorState);
        payload.metadata.dialogue.decision = {requested: false};
        return {...payload, aiModelId: anchorState.aiModelId || null};
    }
    const {output, aiModelId} = await turns.requestHookCompletion(
        service,
        client,
        context,
        {
            hookId: context.decisionHookId,
            values: dialoguePlan.buildDecisionValues(question, turn.userMessage.content),
            requestId,
            aiMessageId: turn.assistantMessage.id,
            parameters: dialoguePlan.DIALOGUE_MODEL_PARAMETERS,
        },
    );
    const decision = dialoguePlan.parseDialogueDecision(output);
    const payload = decision.action === "follow_up"
        ? {
            content: decision.content,
            metadata: dialoguePlan.buildQuestionMetadata(dialoguePlan.DIALOGUE_MESSAGE_KINDS.FOLLOW_UP, question, {
                followUpIndex: followUpsUsed + 1,
            }),
        }
        : dialoguePlan.buildNextQuestionResponse(context.plan, nextQuestion, anchorState);
    payload.metadata.dialogue.decision = {
        requested: true,
        action: decision.action,
        valid: decision.valid,
    };
    return {...payload, aiModelId};
}

module.exports = {prepareResponse};
