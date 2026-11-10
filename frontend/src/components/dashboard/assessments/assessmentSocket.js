/**
 * Request helper for the assessment management socket events (criterion*, later rubric* and assessment*).
 *
 * The backend answers every event with `{success: true, data}` or
 * `{success: false, key, params, message}`. This wraps one emit in a promise that
 * - resolves with `data`,
 * - rejects with an AssessmentRequestError carrying the backend response (translate it with
 *   `resolveApiMessage(error.response)`),
 * - rejects at once when the socket is not connected and after a timeout when no answer arrives
 *   (both with a client-side i18n key in the same `response` shape).
 *
 * No `@/` imports, so the module also runs in plain Node tests.
 *
 * @author Eyad Mohamed
 */

/** Longest wait for an answer before the request counts as failed. */
export const REQUEST_TIMEOUT_MS = 15000;

/** i18n keys of failures that never reached the backend. */
export const CLIENT_ERROR_KEYS = Object.freeze({
  notConnected: "assessmentManagement.messages.notConnected",
  timeout: "assessmentManagement.messages.timeout",
});

/** Failed request; `response` is the backend answer (or a client-side `{key}`). */
export class AssessmentRequestError extends Error {
  /**
   * @param {Object} response - `{success: false, key?, params?, message?}`
   */
  constructor(response) {
    super(response?.key || response?.message || "assessment request failed");
    this.name = "AssessmentRequestError";
    this.response = response ?? {};
  }

  /** @returns {string|undefined} i18n key reported by the backend */
  get key() {
    return this.response.key;
  }
}

/**
 * Emit a socket event and wait for its acknowledgement.
 *
 * @param {Object} socket - Socket with `emit(event, payload, ack)`; `connected === false` fails fast
 * @param {string} event - Event name, e.g. "criterionGetAll"
 * @param {Object} [payload={}] - Request object (the backend requires an object, `{}` if empty)
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<*>} The `data` of a successful answer
 * @throws {AssessmentRequestError}
 */
export function requestAssessment(socket, event, payload = {}, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.connected === false) {
      reject(new AssessmentRequestError({ success: false, key: CLIENT_ERROR_KEYS.notConnected }));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new AssessmentRequestError({ success: false, key: CLIENT_ERROR_KEYS.timeout }));
    }, timeoutMs);
    socket.emit(event, payload, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (response?.success) {
        resolve(response.data);
      } else {
        reject(new AssessmentRequestError(response));
      }
    });
  });
}
