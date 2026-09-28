"use strict";

/**
 * Pure Dialogue plan and anchor policy.
 *
 * @module webserver/services/aiAssistant/dialoguePlan
 * @author Mohammed Rawhani
 */

const {AI_MESSAGE_ROLES} = require("../../../db/models/ai_message");

const ALLOWED_SOURCES = new Set(["pr1"]);
const MAX_ANCHOR_LENGTH = 220;
// Fixed for reproducible Dialogue decisions and anchor selections.
const DIALOGUE_MODEL_PARAMETERS = {temperature: 0};

/**
 * Converts a loose plan JSON into the shape used by Dialogue orchestration.
 *
 * @param {Object} rawPlan - Stored Dialogue plan.
 * @returns {Object} Normalized Dialogue plan.
 */
function normalizeDialoguePlan(rawPlan = {}) {
    const plan = rawPlan && typeof rawPlan === "object" ? rawPlan : {};
    const questions = (Array.isArray(plan.questions) ? plan.questions : [])
        .filter((question) => typeof question?.text === "string" && question.text.trim())
        .map((question, index) => ({
            id: String(question.id || `q${index + 1}`),
            number: index + 1,
            text: question.text.trim(),
            help: typeof question.help === "string" ? question.help.trim() : "",
            anchoredText: typeof question.anchoredText === "string" && question.anchoredText.trim()
                ? question.anchoredText.trim()
                : null,
            answerType: question.answerType || "text",
            options: Array.isArray(question.options) ? question.options : [],
            categoryId: question.categoryId || null,
            source: ALLOWED_SOURCES.has(question.source) ? question.source : null,
            maxFollowUps: question.allowFollowUp === true && Number.isInteger(Number(question.maxFollowUps))
                ? Math.max(0, Number(question.maxFollowUps))
                : 0,
            evidenceGoal: typeof question.evidenceGoal === "string" ? question.evidenceGoal : "",
            completeWhen: typeof question.completeWhen === "string" ? question.completeWhen : "",
            followUpDirection: typeof question.followUpDirection === "string"
                ? question.followUpDirection
                : "",
        }));

    return {
        version: String(plan.version || "1.0"),
        title: typeof plan.title === "string" && plan.title.trim()
            ? plan.title.trim()
            : "Dialogue",
        adaptive: plan.adaptive === true,
        allowSkip: plan.allowSkip === true,
        questions,
        completionMessage: plan.completionMessage || "Thank you. The dialogue is complete.",
    };
}

/**
 * Finds the first unanswered main question.
 *
 * @param {Object} plan - Normalized plan.
 * @param {Object[]} messages - Visible Dialogue messages.
 * @returns {Object|null} Next question, or null when complete.
 */
function selectNextPlanQuestion(plan, messages = []) {
    const answered = new Set(messages
        .filter((message) => message?.metadata?.dialogue?.kind === "answer")
        .map((message) => String(message.metadata.dialogue.questionId))
        .filter(Boolean));
    return plan.questions.find((question) => !answered.has(String(question.id))) || null;
}

/**
 * Parses the model's constrained adaptive decision.
 *
 * Invalid output advances to the next question and is marked as not valid.
 *
 * @param {string} output - Raw model output.
 * @returns {{action: string, content: string, valid: boolean}} Safe decision.
 */
function parseDialogueDecision(output) {
    const parsed = parseJsonObject(output);
    const content = typeof parsed?.content === "string" ? parsed.content.trim() : "";
    if (parsed?.action === "next") return {action: "next", content: "", valid: true};
    if (parsed?.action === "follow_up" && content) return {action: "follow_up", content, valid: true};
    return {action: "next", content: "", valid: false};
}

/**
 * Parses the first JSON object from a model response.
 *
 * @param {string} output - Raw model output.
 * @returns {Object|null} Parsed JSON object, or null.
 */
function parseJsonObject(output) {
    if (typeof output !== "string") return null;
    const trimmed = output.trim();
    const jsonText = trimmed.startsWith("{")
        ? trimmed
        : trimmed.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) return null;
    try {
        const parsed = JSON.parse(jsonText);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (_error) {
        return null;
    }
}

/**
 * Converts basic Editor HTML into comparable plain text.
 *
 * @param {*} value - Candidate text or HTML.
 * @returns {string} Plain text.
 */
function toPlainText(value) {
    if (typeof value !== "string") return "";
    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Divides mapped review content into short source-owned anchor candidates.
 *
 * @param {*} value - Review comment or Editor content.
 * @returns {string[]} Plain-text candidates.
 */
function segmentAnchorText(value) {
    if (typeof value !== "string") return [];
    const blocks = value
        .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:div|h[1-6]|li|p)>/gi, "\n")
        .split(/\n+/)
        .map(toPlainText)
        .filter(Boolean);
    const segmenter = new Intl.Segmenter(undefined, {granularity: "sentence"});
    return blocks.flatMap((block) => {
        const parts = block.length > MAX_ANCHOR_LENGTH
            ? [...segmenter.segment(block)].map(({segment}) => toPlainText(segment))
            : [block];
        return parts.filter(Boolean).map(shortenAnchorQuote);
    });
}

/**
 * Shortens an anchor without changing its source wording.
 *
 * @param {string} value - Verified source quote.
 * @returns {string} Readable source excerpt.
 */
function shortenAnchorQuote(value) {
    if (value.length <= MAX_ANCHOR_LENGTH) return value;
    const prefix = value.slice(0, MAX_ANCHOR_LENGTH);
    const sentenceEnd = prefix.search(/[.!?](?=\s|$)/);
    if (sentenceEnd !== -1) return prefix.slice(0, sentenceEnd + 1);
    const wordEnd = prefix.lastIndexOf(" ");
    return prefix.slice(0, wordEnd > 0 ? wordEnd : MAX_ANCHOR_LENGTH).trim();
}

/**
 * Returns student-authored candidates from the mapped review inputs.
 *
 * @param {Object} inputMappings - Configured context-hook input mappings.
 * @param {Object} values - Resolved context-hook values.
 * @returns {string[]} Unique candidate texts.
 */
function extractSourceCandidates(inputMappings, values) {
    const candidates = Object.entries(inputMappings || {}).flatMap(([key, mapping]) => {
        if (mapping?.type === "editor") return segmentAnchorText(values?.[key]);
        if (mapping?.type !== "annotator" || mapping.key !== "comments") return [];
        const comments = values?.[key];
        const rows = Array.isArray(comments) ? comments : comments?.comments;
        return Array.isArray(rows)
            ? rows.flatMap((comment) => segmentAnchorText(comment?.text || comment?.comment))
            : [];
    });
    return [...new Set(candidates)];
}

/**
 * Builds the compact source snapshot stored with the system message.
 *
 * @param {Object} inputMappings - Configured context-hook input mappings.
 * @param {Object} values - Resolved context-hook values.
 * @returns {{pr1: string[]}} Anchor sources.
 */
function buildAnchorSources(inputMappings = {}, values = {}) {
    return {pr1: extractSourceCandidates(inputMappings, values)};
}

/**
 * Resolves a model-selected candidate index against its configured source.
 *
 * @param {number|null} anchorIndex - Model-selected candidate index.
 * @param {string|null} source - Question source.
 * @param {Object} anchorSources - Stored source snapshot.
 * @returns {string|null} Exact source candidate, or null.
 */
function resolveAnchorCandidate(anchorIndex, source, anchorSources = {}) {
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0) return null;
    return anchorSources[source]?.[anchorIndex] || null;
}

/**
 * Keeps source-verified anchor selections and explicit abstentions.
 *
 * @param {string} output - Raw model output.
 * @param {Object[]} questions - Normalized Dialogue questions.
 * @param {Object} anchorSources - Stored source snapshot.
 * @returns {Object} Question-id to verified candidate-index or null mapping.
 */
function parseAnchorSelections(output, questions = [], anchorSources = {}) {
    const parsed = parseJsonObject(output);
    const requested = parsed?.selections;
    if (!requested || typeof requested !== "object" || Array.isArray(requested)) return {};
    return questions.reduce((selections, question) => {
        if (!question.anchoredText || !Object.hasOwn(requested, question.id)) return selections;
        const anchorIndex = requested[question.id];
        if (anchorIndex === null || resolveAnchorCandidate(anchorIndex, question.source, anchorSources)) {
            selections[question.id] = anchorIndex;
        }
        return selections;
    }, {});
}

/**
 * Renders an anchored question or its configured fallback.
 *
 * @param {Object} question - Normalized question.
 * @param {number|null} anchorIndex - Model-selected candidate index.
 * @param {Object} anchorSources - Stored source snapshot.
 * @returns {{text: string, anchorText: string|null, anchorVerified: boolean}} Render result.
 */
function renderQuestion(question, anchorIndex, anchorSources = {}) {
    if (!question.anchoredText) {
        return {text: question.text, anchorText: null, anchorVerified: false};
    }
    const anchorText = resolveAnchorCandidate(anchorIndex, question.source, anchorSources);
    return anchorText
        ? {
            text: question.anchoredText.replace("{{anchor}}", anchorText),
            anchorText,
            anchorVerified: true,
        }
        : {text: question.text, anchorText: null, anchorVerified: false};
}

/**
 * Builds visible assistant-question metadata.
 *
 * @param {string} kind - Dialogue message kind.
 * @param {Object} question - Normalized question.
 * @param {Object} [rendered] - Rendered anchor and follow-up metadata.
 * @returns {Object} AI message metadata.
 */
function buildQuestionMetadata(kind, question, rendered = {}) {
    return {
        dialogue: {
            kind,
            questionId: question.id,
            questionNumber: question.number || null,
            answerType: question.answerType,
            options: question.options,
            help: kind === "main_question" ? question.help || null : null,
            categoryId: question.categoryId,
            source: question.source,
            anchorText: rendered.anchorText || null,
            anchorVerified: rendered.anchorVerified === true,
            followUpIndex: kind === "follow_up" ? rendered.followUpIndex || 1 : null,
        },
    };
}

/**
 * Builds visible user-answer metadata.
 *
 * @param {Object} question - Normalized question.
 * @param {*} answerValue - Stored answer value.
 * @param {boolean} [skipped] - Whether the student skipped the question.
 * @returns {Object} AI message metadata.
 */
function buildAnswerMetadata(question, answerValue, skipped = false) {
    return {
        dialogue: {
            kind: "answer",
            questionId: question.id,
            answerType: question.answerType,
            answerValue,
            skipped,
        },
    };
}

/**
 * Returns the question currently waiting for an answer.
 *
 * @param {Object} plan - Normalized dialogue plan.
 * @param {Object[]} messages - Visible dialogue messages.
 * @returns {Object|null} Current question.
 */
function getCurrentQuestion(plan, messages = []) {
    const latest = [...messages].map((message, index) => ({message, index})).reverse()
        .find(({message}) => {
            const kind = message?.metadata?.dialogue?.kind;
            return Number(message.role) === AI_MESSAGE_ROLES.ASSISTANT
                && ["main_question", "follow_up"].includes(kind);
        });
    const latestQuestionId = latest?.message?.metadata?.dialogue?.questionId;
    const hasAnswerAfterLatestQuestion = latest && messages.slice(latest.index + 1)
        .some((message) => Number(message.role) === AI_MESSAGE_ROLES.USER
            && message?.metadata?.dialogue?.kind === "answer"
            && String(message.metadata.dialogue.questionId) === String(latestQuestionId));
    if (latestQuestionId && !hasAnswerAfterLatestQuestion) {
        const configuredQuestion = plan.questions.find(
            (question) => String(question.id) === String(latestQuestionId),
        ) || {};
        const question = {
            ...configuredQuestion,
            id: String(latestQuestionId),
            number: latest.message.metadata.dialogue.questionNumber
                || configuredQuestion.number
                || null,
            text: latest.message.content,
            answerType: latest.message.metadata.dialogue.answerType || "text",
            options: latest.message.metadata.dialogue.options || [],
            categoryId: latest.message.metadata.dialogue.categoryId || null,
            source: latest.message.metadata.dialogue.source || null,
        };
        delete question.anchoredText;
        return question;
    }
    return selectNextPlanQuestion(plan, messages);
}

/**
 * Returns the active question and rejects stale or fabricated question ids.
 *
 * @param {Object} plan - Normalized dialogue plan.
 * @param {Object[]} messages - Visible dialogue messages.
 * @param {string|number|null} questionId - Question id submitted by the client.
 * @returns {Object} Current question.
 */
function requireCurrentQuestion(plan, messages, questionId) {
    const question = getCurrentQuestion(plan, messages);
    if (!question) {
        throw new Error("Dialogue is already complete");
    }
    if (questionId && String(question.id) !== String(questionId)) {
        throw new Error("Question is no longer active");
    }
    return question;
}

/**
 * Counts completed follow-ups already asked for a main question.
 *
 * @param {Object[]} messages - Visible dialogue messages.
 * @param {string} questionId - Main question identifier.
 * @returns {number} Follow-up count.
 */
function countFollowUps(messages, questionId) {
    return messages.filter((message) =>
        Number(message.role) === AI_MESSAGE_ROLES.ASSISTANT
        && message?.metadata?.dialogue?.kind === "follow_up"
        && String(message.metadata.dialogue.questionId) === String(questionId)
    ).length;
}

/**
 * Builds the backend-owned decision prompt values.
 *
 * Only the fields named in the decision prompt are sent to the model.
 *
 * @param {Object} question - Current question.
 * @param {string} answerText - Latest answer text.
 * @returns {Object} Prompt values.
 */
function buildDecisionValues(question, answerText) {
    const {text, help, evidenceGoal, completeWhen, followUpDirection} = question;
    return {
        "dialogueDecision[1]": JSON.stringify({
            currentQuestion: {text, help, evidenceGoal, completeWhen, followUpDirection},
            latestAnswer: {content: answerText},
        }),
    };
}

/**
 * Renders the next configured question or the dialogue completion.
 * @param {Object} plan - Normalized dialogue plan.
 * @param {Object|null} question - Next configured question.
 * @param {Object} [anchorState] - Stored verified anchors.
 * @returns {Object} Final message content and metadata.
 */
function buildNextQuestionResponse(plan, question, anchorState = {}) {
    if (!question) {
        return {content: plan.completionMessage, metadata: {dialogue: {kind: "completion"}}};
    }
    const rendered = renderQuestion(
        question, anchorState.anchorSelections?.[question.id], anchorState.anchorSources,
    );
    return {content: rendered.text, metadata: buildQuestionMetadata("main_question", question, rendered)};
}

module.exports = {
    DIALOGUE_MODEL_PARAMETERS,
    buildNextQuestionResponse,
    buildQuestionMetadata,
    buildAnswerMetadata,
    getCurrentQuestion,
    requireCurrentQuestion,
    countFollowUps,
    buildDecisionValues,
    buildAnchorSources,
    normalizeDialoguePlan,
    parseAnchorSelections,
    parseDialogueDecision,
    renderQuestion,
    selectNextPlanQuestion,
};
