/**
 * Small helpers shared by the assessment management modals.
 *
 * Error values are i18n keys relative to `assessmentManagement.errors`. The forms have their own checks
 * (criterionForm.js, rubricForm.js, assessmentForm.js); the backend decides what is valid.
 *
 * @author Eyad Mohamed
 */

/**
 * Convert the raw string of a number input; empty stays empty so "required" can be reported.
 *
 * @param {string} raw - Input value
 * @returns {number|string}
 */
export function parsePoints(raw) {
  return String(raw).trim() === "" ? "" : Number(raw);
}

/**
 * Translate the errors of fields the user has already interacted with.
 *
 * @param {Object} errors - Field → error key, from the validate* functions
 * @param {Object} touched - Field → true once the user left the field
 * @param {Function} $t - vue-i18n translate function
 * @returns {Object} Field → translated message
 */
export function visibleErrors(errors, touched, $t) {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([field]) => touched[field])
      .map(([field, key]) => [field, $t(`assessmentManagement.errors.${key}`)])
  );
}
