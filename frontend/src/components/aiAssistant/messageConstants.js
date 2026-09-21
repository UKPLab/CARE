/**
 * AI message role and status codes, mirrored from the backend `ai_message` model.
 *
 * Single frontend source of truth so chat and dialogue surfaces cannot drift.
 *
 * @author Mohammed Rawhani
 */

export const MESSAGE_ROLES = Object.freeze({
  SYSTEM: 0,
  USER: 1,
  ASSISTANT: 2,
});

export const MESSAGE_STATUSES = Object.freeze({
  PENDING: 0,
  COMPLETED: 1,
  FAILED: 2,
  ABORTED: 3,
});
