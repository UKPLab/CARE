/**
 * Form model of the criterion modal: defaults, mapping from and to the backend contract
 * (`criterionCreate`, `criterionCreateVersion`, `criterionGet`) and the checks that run before a request.
 *
 * The backend decides what is valid; these checks only repeat its rules so the user sees the problem before
 * sending: a name, optional bounds (a bound that is switched off is `null`; negative and decimal values are
 * fine; `minPoints <= maxPoints` when both are active), Advanced Settings without empty or duplicate keys, and
 * every scoring option's points inside the active bounds. The version number is never entered: the backend
 * assigns it (1, 2, 3, ...). Points need not be integers, options need no unique points or description, and a
 * criterion may have no options.
 *
 * Error values are keys relative to `assessmentManagement.errors`. No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */
import { boundsError } from "./pointBounds.js";
import { rowsFromSettings, settingsFromRows, validateSettingsRows } from "./settingsForm.js";

/** The three ways the modal opens. */
export const CRITERION_MODES = Object.freeze({ create: "create", view: "view", version: "version" });

/** varchar(255) columns in the database. */
export const MAX_TEXT_LENGTH = 255;

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Empty form of a new criterion: both bounds switched off, no settings.
 *
 * @returns {Object} Form values
 */
export function emptyCriterionForm() {
  return {
    name: "",
    description: "",
    minActive: false,
    minPoints: 0,
    maxActive: false,
    maxPoints: 0,
    settingsRows: [],
  };
}

/**
 * Form values of a stored criterion version. A `null` bound is switched off. Used to view a version or as the
 * starting point of a new one; stored settings keep their JSON types until the user edits a value.
 *
 * @param {Object} criterion - Criterion as returned by the backend
 * @returns {Object} Form values
 */
export function formFromCriterion(criterion) {
  const hasMin = isNumber(criterion.minPoints);
  const hasMax = isNumber(criterion.maxPoints);
  return {
    name: criterion.name ?? "",
    description: criterion.description ?? "",
    minActive: hasMin,
    minPoints: hasMin ? criterion.minPoints : 0,
    maxActive: hasMax,
    maxPoints: hasMax ? criterion.maxPoints : 0,
    settingsRows: rowsFromSettings(criterion.settings),
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
 * Scoring options of a stored criterion in stored order, without database ids: a copy never reuses the rows
 * of the original.
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
 * The active bounds as numbers; a switched-off bound or an invalid number is `null` (not enforced).
 *
 * @param {{minActive: boolean, minPoints: *, maxActive: boolean, maxPoints: *}} form
 * @returns {{min: number|null, max: number|null}}
 */
export function activeBounds(form) {
  return {
    min: form.minActive && isNumber(form.minPoints) ? form.minPoints : null,
    max: form.maxActive && isNumber(form.maxPoints) ? form.maxPoints : null,
  };
}

/**
 * The bounds of a criterion as numbers; an empty or invalid bound is `null` (not enforced).
 *
 * @param {number|string|null} min - Minimum points
 * @param {number|string|null} max - Maximum points
 * @returns {{min: number|null, max: number|null}}
 */
export function pointBounds(min, max) {
  return { min: isNumber(min) ? min : null, max: isNumber(max) ? max : null };
}

/**
 * Request body of `criterionCreate`, and the content fields of `criterionCreateVersion`. A switched-off bound
 * is `null` (never 0); settings are sent as a whole (typed values as strings, untouched stored values with their
 * type); options keep their order and carry no ids. No version number: the backend assigns it.
 *
 * @param {Object} form - Form values
 * @param {Array<{points: number|string, description: string}>} options - Scoring options in display order
 * @returns {Object} Payload fields
 */
export function toCriterionPayload(form, options) {
  const { min, max } = activeBounds(form);
  return {
    name: form.name,
    description: form.description ?? "",
    minPoints: min,
    maxPoints: max,
    settings: settingsFromRows(form.settingsRows),
    scoringOptions: options.map(({ points, description }) => ({ points: Number(points), description: description ?? "" })),
  };
}

/**
 * Body of `criterionCreateVersion`: the source version, its group and the full edited content, so the new
 * version is exactly what the user sees (including switched-off bounds, removed settings and removed options).
 *
 * @param {Object} source - Version the user started from (`id`, `criterionGroupId`)
 * @param {Object} form - Form values
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
 * @returns {Object} Field → error key (`settings` → the object of validateSettingsRows); empty when valid
 */
export function validateCriterionForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "required";
  else if (String(form.name).length > MAX_TEXT_LENGTH) errors.name = "tooLong";

  if (form.minActive && !isNumber(form.minPoints)) errors.minPoints = "number";
  if (form.maxActive && !isNumber(form.maxPoints)) errors.maxPoints = "number";
  const { min, max } = activeBounds(form);
  const range = boundsError(min, max);
  if (range && !errors.maxPoints) errors.maxPoints = range;

  const settings = validateSettingsRows(form.settingsRows);
  if (settings.general || Object.keys(settings.rows).length) errors.settings = settings;
  return errors;
}

/**
 * Check the scoring options (step 2): every option needs a numeric point value (negative and decimal values
 * included) that lies within the active bounds. With only one bound active only that bound applies, with none
 * any number is fine. Entered values are never changed. The result changes with the bounds, so editing them in
 * step 1 revalidates the options.
 *
 * @param {Array<{uid: number, points: number|string}>} options - Scoring options
 * @param {number|string|null} [min] - Active minimum points (null/empty: none)
 * @param {number|string|null} [max] - Active maximum points (null/empty: none)
 * @returns {Object<number, {points: string}>} Option uid → field errors (`required`, `number`,
 *   `pointsBetween`, `pointsAtLeast` or `pointsAtMost`); empty when valid
 */
export function validateOptionList(options, min = null, max = null) {
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
const BACKEND_FIELDS = new Set(["name", "description", "minPoints", "maxPoints", "settings"]);

/**
 * The input a backend error belongs to, so it can be shown next to it.
 *
 * @param {Object} response - Backend error answer (`key`, `params`)
 * @returns {{field: string|null, step: number|null}} Field name (null when the error is general) and the
 *   modal step (0 or 1) to show; `step` is null for a general error, the modal stays where it is
 */
export function errorTarget(response) {
  const key = response?.key;
  if (key === "errors.assessment.pointsRange") return { field: "maxPoints", step: 0 };
  if (key?.startsWith("errors.assessment.settings")) return { field: "settings", step: 0 };
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
