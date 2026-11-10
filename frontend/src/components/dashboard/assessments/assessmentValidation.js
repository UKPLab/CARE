/**
 * Pure validation helpers for the assessment management modals.
 *
 * Every function returns an object mapping a field name to an i18n key
 * (relative to `assessmentManagement.errors`); an empty object means valid.
 * Cross-field rules (min/max, duplicate codes) live here so the modals only decide when to show the
 * messages. The criterion form has its own checks in criterionForm.js (versioned, backend-backed).
 *
 * @author Eyad Mohamed
 */
import { usesDefaultPoints } from "./assessmentConstants.js";

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";
const isInteger = (value) => typeof value === "number" && Number.isInteger(value);

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

/**
 * True if another record already uses the code (case-insensitive).
 *
 * @param {string} code - Code entered by the user
 * @param {Array<{id: number, code: string}>} records - Existing records
 * @param {number|null} selfId - Id of the record being edited
 * @returns {boolean}
 */
export function isDuplicateCode(code, records, selfId) {
  const normalized = String(code || "").trim().toLowerCase();
  return records.some((r) => r.id !== selfId && String(r.code).trim().toLowerCase() === normalized);
}

/**
 * Validate min/max fields shared by rubrics and criteria.
 *
 * @param {Object} form - Form with minPoints and maxPoints
 * @returns {Object} Errors keyed by field
 */
function validatePointRange(form) {
  const errors = {};
  if (isBlank(form.minPoints)) errors.minPoints = "required";
  else if (!isInteger(form.minPoints)) errors.minPoints = "integer";
  if (isBlank(form.maxPoints)) errors.maxPoints = "required";
  else if (!isInteger(form.maxPoints)) errors.maxPoints = "integer";
  if (!errors.minPoints && !errors.maxPoints && form.maxPoints < form.minPoints) {
    errors.maxPoints = "maxBelowMin";
  }
  return errors;
}

/**
 * Validate assessment step 1.
 *
 * @param {Object} form - name, description, version
 * @returns {Object} Errors keyed by field
 */
export function validateAssessmentDetails(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "required";
  if (isBlank(form.version)) errors.version = "required";
  return errors;
}

/**
 * Validate rubric step 1.
 *
 * @param {Object} form - Rubric form values
 * @param {Array} rubrics - All rubrics (for the unique code check)
 * @param {number|null} selfId - Id of the rubric being edited
 * @returns {Object} Errors keyed by field
 */
export function validateRubricDetails(form, rubrics, selfId) {
  const errors = validatePointRange(form);
  if (isBlank(form.name)) errors.name = "required";
  if (isBlank(form.code)) errors.code = "required";
  else if (isDuplicateCode(form.code, rubrics, selfId)) errors.code = "duplicateCode";
  if (usesDefaultPoints(form.calculation)) {
    if (isBlank(form.defaultPoints)) errors.defaultPoints = "required";
    else if (!isInteger(form.defaultPoints)) errors.defaultPoints = "integer";
    else if (!errors.minPoints && !errors.maxPoints
      && (form.defaultPoints < form.minPoints || form.defaultPoints > form.maxPoints)) {
      errors.defaultPoints = "defaultOutOfRange";
    }
  }
  return errors;
}
