/**
 * Form model of the criterion modal: defaults, mapping from and to the backend contract
 * (`criterionCreate`, `criterionCreateVersion`, `criterionGet`) and the checks that run before a request.
 *
 * The backend decides what is valid; these checks only repeat its rules so the user sees the problem
 * before sending: required text fields, a version number made of numbers separated by dots, numbers where
 * numbers are expected, an integer expert level (any whole number the database column can hold),
 * `minPoints <= maxPoints` when both are set, and every option's points inside the
 * criterion's bounds (a missing bound is not enforced). Points need not be integers, options need no unique
 * points or description, and a criterion may have no options.
 *
 * Error values are keys relative to `assessmentManagement.errors`. No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */

/** The three ways the modal opens. */
export const CRITERION_MODES = Object.freeze({ create: "create", view: "view", version: "version" });

/** varchar(255) columns in the database. */
export const MAX_TEXT_LENGTH = 255;

/** The expert level is an INTEGER column: the only limits are those of a signed 32-bit integer. */
export const INTEGER_MIN = -2147483648;
export const INTEGER_MAX = 2147483647;

/**
 * Format of a version number: numbers separated by single dots (1, 1.1, 2.0.3). Same rule as
 * VERSION_PATTERN in backend/utils/helper/assessmentVersions.js; stored versions of another form stay
 * readable, the rule only applies to what the user enters.
 */
export const VERSION_PATTERN = /^\d+(\.\d+)*$/;

/** Form fields of step 1, in display order. */
export const DETAIL_FIELDS = Object.freeze([
  "name", "versionNumber", "description", "minPoints", "maxPoints", "function", "expertLevel", "subjective",
]);

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Empty form of a new criterion. Points are empty (optional, sent as null); expert level needs a value
 * because the backend requires an integer.
 *
 * @returns {Object} Form values
 */
export function emptyCriterionForm() {
  return {
    versionNumber: "",
    name: "",
    description: "",
    minPoints: "",
    maxPoints: "",
    function: "",
    subjective: false,
    expertLevel: 1,
  };
}

/**
 * Form values of a stored criterion version; `null` fields become empty inputs.
 * Used to view a version or as the starting point of a new one. The version number is copied too, and the
 * caller clears it for a new version so the user has to enter one.
 *
 * @param {Object} criterion - Criterion as returned by the backend
 * @returns {Object} Form values
 */
export function formFromCriterion(criterion) {
  return {
    versionNumber: criterion.versionNumber ?? "",
    name: criterion.name ?? "",
    description: criterion.description ?? "",
    minPoints: criterion.minPoints ?? "",
    maxPoints: criterion.maxPoints ?? "",
    function: criterion.function ?? "",
    subjective: Boolean(criterion.subjective),
    expertLevel: criterion.expertLevel,
  };
}

/**
 * The identifying part of a stored version, kept while the modal shows or copies it.
 *
 * @param {Object|null} criterion - Criterion as returned by the backend
 * @returns {{id: number, criterionGroupId: number, versionNumber: string, name: string}|null}
 */
export function versionSource(criterion) {
  return criterion
    ? { id: criterion.id, criterionGroupId: criterion.criterionGroupId, versionNumber: criterion.versionNumber, name: criterion.name }
    : null;
}

/**
 * Scoring options of a stored criterion in stored order, without database ids: a copy never reuses
 * the rows of the original.
 *
 * @param {Object} criterion - Criterion as returned by the backend
 * @returns {Array<{points: number, description: string}>}
 */
export function optionsFromCriterion(criterion) {
  return [...(criterion.scoringOptions ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(({ points, description }) => ({ points, description }));
}

/**
 * Request body of `criterionCreate`, and the content fields of `criterionCreateVersion`.
 * Empty points and function become `null` (never 0); options keep their order and carry no ids.
 *
 * @param {Object} form - Form values
 * @param {Array<{points: number|string, description: string}>} options - Scoring options in display order
 * @returns {Object} Payload fields
 */
export function toCriterionPayload(form, options) {
  return {
    versionNumber: String(form.versionNumber).trim(),
    name: form.name,
    description: form.description ?? "",
    minPoints: isBlank(form.minPoints) ? null : Number(form.minPoints),
    maxPoints: isBlank(form.maxPoints) ? null : Number(form.maxPoints),
    function: isBlank(form.function) ? null : form.function,
    subjective: Boolean(form.subjective),
    expertLevel: Number(form.expertLevel),
    scoringOptions: options.map(({ points, description }) => ({ points: Number(points), description: description ?? "" })),
  };
}

/**
 * Body of `criterionCreateVersion`: the source version, its group and the full edited content, so the
 * new version is exactly what the user sees (including cleared fields and removed options).
 *
 * @param {Object} source - Version the user started from (`id`, `criterionGroupId`)
 * @param {Object} form - Form values, `versionNumber` entered by the user
 * @param {Array} options - Scoring options in display order
 * @returns {Object}
 */
export function versionRequest(source, form, options) {
  return {
    criterionGroupId: source.criterionGroupId,
    copyFromId: source.id,
    ...toCriterionPayload(form, options),
  };
}

/**
 * Check step 1 of the form.
 *
 * @param {Object} form - Form values
 * @returns {Object} Field → error key; empty when valid
 */
export function validateCriterionForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "required";
  else if (String(form.name).length > MAX_TEXT_LENGTH) errors.name = "tooLong";

  if (isBlank(form.versionNumber)) errors.versionNumber = "required";
  else if (String(form.versionNumber).trim().length > MAX_TEXT_LENGTH) errors.versionNumber = "tooLong";
  else if (!VERSION_PATTERN.test(String(form.versionNumber).trim())) errors.versionNumber = "versionFormat";

  for (const field of ["minPoints", "maxPoints"]) {
    if (!isBlank(form[field]) && !isNumber(form[field])) errors[field] = "number";
  }
  if (!errors.minPoints && !errors.maxPoints && !isBlank(form.minPoints) && !isBlank(form.maxPoints)
    && form.maxPoints < form.minPoints) {
    errors.maxPoints = "maxBelowMin";
  }
  if (isBlank(form.expertLevel)) errors.expertLevel = "required";
  else if (!Number.isInteger(form.expertLevel)) errors.expertLevel = "integer";
  else if (form.expertLevel < INTEGER_MIN || form.expertLevel > INTEGER_MAX) errors.expertLevel = "integerRange";
  if (!isBlank(form.function) && String(form.function).length > MAX_TEXT_LENGTH) errors.function = "tooLong";
  return errors;
}

/**
 * The bounds of a criterion as numbers; an empty or invalid bound is `null` (not enforced).
 *
 * @param {number|string} min - Minimum points from the form
 * @param {number|string} max - Maximum points from the form
 * @returns {{min: number|null, max: number|null}}
 */
export function pointBounds(min, max) {
  return { min: isNumber(min) ? min : null, max: isNumber(max) ? max : null };
}

/**
 * Check the scoring options (step 2): every option needs a numeric point value (negative and decimal
 * values included) that lies within the criterion's bounds. With only one bound set only that bound
 * applies, with none any number is fine. Entered values are never changed. The result changes with the
 * bounds, so editing them in step 1 revalidates the options.
 *
 * @param {Array<{uid: number, points: number|string}>} options - Scoring options
 * @param {number|string} [min] - Criterion minimum points (empty: none)
 * @param {number|string} [max] - Criterion maximum points (empty: none)
 * @returns {Object<number, {points: string}>} Option uid → field errors (`required`, `number`,
 *   `pointsBetween`, `pointsAtLeast` or `pointsAtMost`); empty when valid
 */
export function validateOptionList(options, min = "", max = "") {
  const bounds = pointBounds(min, max);
  const rangeError = bounds.min !== null && bounds.max !== null ? "pointsBetween"
    : bounds.min !== null ? "pointsAtLeast" : "pointsAtMost";
  const byOption = {};
  for (const option of options) {
    if (isBlank(option.points)) byOption[option.uid] = { points: "required" };
    else if (!isNumber(option.points)) byOption[option.uid] = { points: "number" };
    else if ((bounds.min !== null && option.points < bounds.min) || (bounds.max !== null && option.points > bounds.max)) {
      byOption[option.uid] = { points: rangeError };
    }
  }
  return byOption;
}

/** Fields the backend names in `fieldRequired` / `fieldInvalid` that have an input in step 1. */
const BACKEND_FIELDS = new Set(DETAIL_FIELDS);

/**
 * The input a backend error belongs to, so it can be shown next to it.
 *
 * @param {Object} response - Backend error answer (`key`, `params`)
 * @returns {{field: string|null, step: number|null}} Field name (null when the error is general) and the
 *   modal step (0 or 1) to show; `step` is null for a general error, the modal stays where it is
 */
export function errorTarget(response) {
  const key = response?.key;
  if (key === "errors.assessment.criterion.versionExists") return { field: "versionNumber", step: 0 };
  if (key === "errors.assessment.pointsRange") return { field: "maxPoints", step: 0 };
  if (key === "errors.assessment.versionFormat") return { field: "versionNumber", step: 0 };
  if (["errors.assessment.optionInvalid", "errors.assessment.optionBelowMin", "errors.assessment.optionAboveMax"].includes(key)) {
    return { field: null, step: 1 };
  }
  if (key === "errors.assessment.fieldRequired" || key === "errors.assessment.fieldInvalid") {
    const field = response.params?.field;
    if (field === "scoringOptions") return { field: null, step: 1 };
    if (BACKEND_FIELDS.has(field)) return { field, step: 0 };
  }
  return { field: null, step: null };
}

/**
 * Escape text before it goes into an HTML string (the confirm dialog renders its message as HTML).
 *
 * @param {*} value - Text, e.g. a criterion name
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}
