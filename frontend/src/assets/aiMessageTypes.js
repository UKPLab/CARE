/**
 * AI message role and status codes, mirrored from the backend `ai_message` model.
 *
 * Single frontend source of truth so chat and dialogue surfaces cannot drift.
 *
 * @author Mohammed Rawhani
 */

// Keep in sync with backend/db/models/ai_message.js.
export const AI_MESSAGE_ROLES = Object.freeze({
  SYSTEM: 0,
  USER: 1,
  ASSISTANT: 2,
});

export const AI_MESSAGE_STATUSES = Object.freeze({
  PENDING: 0,
  COMPLETED: 1,
  FAILED: 2,
  ABORTED: 3,
});
