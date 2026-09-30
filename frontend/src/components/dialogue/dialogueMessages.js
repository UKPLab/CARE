/**
 * Builds display messages and turns for Dialogue.
 * @author Mohammed Rawhani
 */
import {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} from "@/assets/aiMessageTypes";

const QUESTION_KINDS = Object.freeze(["main_question", "follow_up"]);

/**
 * Returns true when a message is a Dialogue question.
 *
 * @param {Object} message - AI message row.
 * @returns {boolean} Whether the message is a question.
 */
export function isDialogueQuestion(message) {
  const kind = message?.metadata?.dialogue?.kind;
  return Number(message?.role) === AI_MESSAGE_ROLES.ASSISTANT
      && Number(message?.status) === AI_MESSAGE_STATUSES.COMPLETED
      && QUESTION_KINDS.includes(kind);
}

/**
 * Returns true when a message is a student Dialogue answer.
 *
 * @param {Object} message - AI message row.
 * @returns {boolean} Whether the message is an answer.
 */
function isDialogueAnswer(message) {
  return Number(message?.role) === AI_MESSAGE_ROLES.USER
      && message?.metadata?.dialogue?.kind === "answer";
}

/**
 * Returns true when a message is the pending/failed assistant response for an answer.
 *
 * @param {Object} message - AI message row.
 * @returns {boolean} Whether the message is a response placeholder.
 */
function isDialogueResponse(message) {
  return Number(message?.role) === AI_MESSAGE_ROLES.ASSISTANT
      && message?.metadata?.dialogue?.kind === "pending";
}

/**
 * Creates a display turn for a main Dialogue question.
 *
 * @param {Object} message - AI question message.
 * @returns {Object} Display turn.
 */
function createQuestionTurn(message) {
  return {
    type: "question",
    id: `question_${message.id}`,
    question: message,
    answer: null,
    response: null,
    followUps: [],
  };
}

/**
 * Creates a nested display turn for a Dialogue follow-up.
 *
 * @param {Object} message - AI follow-up message.
 * @returns {Object} Display turn.
 */
function createFollowUpTurn(message) {
  return {
    id: `follow_up_${message.id}`,
    question: message,
    answer: null,
    response: null,
  };
}

/**
 * Finds the parent main-question turn for a follow-up.
 *
 * @param {Object[]} turns - Dialogue display turns.
 * @param {Object} message - AI follow-up message.
 * @returns {Object|null} Matching main-question turn.
 */
function findParentQuestionTurn(turns, message) {
  const questionId = String(message?.metadata?.dialogue?.questionId || "");
  return [...turns].reverse().find((turn) =>
    turn.type === "question"
      && String(turn.question?.metadata?.dialogue?.questionId || "") === questionId
  ) || null;
}

/**
 * Finds the nearest earlier question or follow-up for the same plan question.
 *
 * @param {Object[]} turns - Dialogue display turns.
 * @param {Object} message - AI message row.
 * @param {boolean} requireOpen - Whether the item must be unanswered.
 * @returns {Object|null} Matching turn.
 */
function findNearestQuestionTurn(turns, message, requireOpen = true) {
  const questionId = String(message?.metadata?.dialogue?.questionId || "");
  for (const turn of [...turns].reverse()) {
    if (turn.type !== "question") continue;
    const followUp = [...turn.followUps].reverse().find((item) =>
      (!requireOpen || !item.answer)
        && String(item.question?.metadata?.dialogue?.questionId || "") === questionId
    );
    if (followUp) return followUp;
    if (
      (!requireOpen || !turn.answer)
        && String(turn.question?.metadata?.dialogue?.questionId || "") === questionId
    ) {
      return turn;
    }
  }
  return null;
}

/**
 * Groups flat AI messages into Dialogue question-answer turns.
 *
 * @param {Object[]} messages - Visible AI messages.
 * @returns {Object[]} Display items.
 */
export function buildDialogueTurns(messages = []) {
  const turns = [];
  messages.forEach((message) => {
    if (isDialogueQuestion(message)) {
      if (message.metadata.dialogue.kind === "follow_up") {
        const parent = findParentQuestionTurn(turns, message);
        if (parent) {
          parent.followUps.push(createFollowUpTurn(message));
        } else {
          turns.push(createQuestionTurn(message));
        }
      } else {
        turns.push(createQuestionTurn(message));
      }
      return;
    }
    if (isDialogueAnswer(message)) {
      const turn = findNearestQuestionTurn(turns, message);
      if (turn) {
        turn.answer = message;
      } else {
        turns.push({type: "message", id: `message_${message.id}`, message});
      }
      return;
    }
    if (isDialogueResponse(message)) {
      const turn = findNearestQuestionTurn(turns, message, false);
      if (turn) {
        turn.response = message;
      } else {
        turns.push({type: "message", id: `message_${message.id}`, message});
      }
      return;
    }
    turns.push({type: "message", id: `message_${message.id}`, message});
  });
  return turns;
}

/**
 * Builds a visible question message before the first answer is stored.
 *
 * @param {Object} question - Current Dialogue question.
 * @returns {Object} Virtual AI message.
 */
export function buildDialogueQuestionMessage(question) {
  return {
    id: `question_${question.id}`,
    role: AI_MESSAGE_ROLES.ASSISTANT,
    content: question.text,
    status: AI_MESSAGE_STATUSES.COMPLETED,
    metadata: {
      dialogue: {
        kind: "main_question",
        questionId: question.id,
        questionNumber: question.number || null,
        answerType: question.answerType,
        options: question.options || [],
        help: question.help || null,
      },
    },
  };
}

/**
 * Builds the local answer message shown while the request is running.
 *
 * @param {Object} question - Current Dialogue question.
 * @param {string} content - Student answer text.
 * @returns {Object} Virtual AI message.
 */
export function buildDialogueAnswerMessage(question, content, skipped = false) {
  return {
    id: "pending-user",
    role: AI_MESSAGE_ROLES.USER,
    content,
    status: AI_MESSAGE_STATUSES.COMPLETED,
    metadata: {
      dialogue: {
        kind: "answer",
        questionId: question.id,
        answerType: question.answerType,
        skipped,
      },
    },
  };
}

/**
 * Builds the local assistant pending message shown while the request is running.
 *
 * @param {Object} question - Current Dialogue question.
 * @returns {Object} Virtual AI message.
 */
export function buildDialoguePendingMessage(question) {
  return {
    id: "pending-assistant",
    role: AI_MESSAGE_ROLES.ASSISTANT,
    content: "",
    status: AI_MESSAGE_STATUSES.PENDING,
    metadata: {dialogue: {kind: "pending", questionId: question.id}},
  };
}

/**
 * Separates a verified review anchor from its surrounding question text.
 *
 * @param {Object} message - AI question message.
 * @returns {{before: string, anchor: string, after: string}|null} Visible question parts.
 */
export function splitDialogueQuestionText(message) {
  const dialogue = message?.metadata?.dialogue || {};
  const anchor = dialogue.anchorVerified === true ? dialogue.anchorText : null;
  const content = message?.content || "";
  if (!anchor) return null;
  const index = content.indexOf(anchor);
  if (index === -1) return null;
  const before = content.slice(0, index).replace(/[“"'‘’]\s*$/, "").trim();
  let after = content.slice(index + anchor.length).replace(/^\s*[”"'‘’]/, "").trim();
  if (/^[.!?]$/.test(after)) after = "";
  return {before, anchor, after};
}

