/**
 * Form model of the rubric modal: defaults, mapping from and to the backend contract (`rubricCreate`,
 * `rubricCreateVersion`, `rubricGet`) and the checks that run before a request.
 *
 * Like the criterion form: optional bounds (a switched-off bound is `null`), Advanced Settings as key/value rows,
 * no version number (the backend assigns it). A rubric also has a calculation method (`sum` or `max` for new
 * rubrics; an older stored value such as `min` is kept), the start value `defaultPoints` of the `max` method and
 * the bonus flag. Its criteria are chosen by criterion VERSION ids, in order.
 *
 * Error values are keys relative to `assessmentManagement.errors`. No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */
import { usesDefaultPoints } from "./assessmentConstants.js";
import { activeBounds, MAX_TEXT_LENGTH } from "./criterionForm.js";
import { boundsError } from "./pointBounds.js";
import { rowsFromSettings, settingsFromRows, validateSettingsRows } from "./settingsForm.js";

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Empty form of a new rubric: summation, both bounds switched off, not a bonus rubric, no settings.
 *
 * @returns {Object} Form values
 */
export function emptyRubricForm() {
  return {
    name: "",
    description: "",
    minActive: false,
    minPoints: 0,
    maxActive: false,
    maxPoints: 0,
    calculation: "sum",
    defaultPoints: "",
    isBonus: false,
    settingsRows: [],
  };
}

/**
 * Form values of a stored rubric version. A `null` bound is switched off; the stored calculation (also a legacy
 * one) and the settings with their JSON types are kept.
 *
 * @param {Object} rubric - Rubric as returned by the backend
 * @returns {Object} Form values
 */
export function formFromRubric(rubric) {
  const hasMin = isNumber(rubric.minPoints);
  const hasMax = isNumber(rubric.maxPoints);
  return {
    name: rubric.name ?? "",
    description: rubric.description ?? "",
    minActive: hasMin,
    minPoints: hasMin ? rubric.minPoints : 0,
    maxActive: hasMax,
    maxPoints: hasMax ? rubric.maxPoints : 0,
    calculation: rubric.calculation ?? "sum",
    defaultPoints: isNumber(rubric.defaultPoints) ? rubric.defaultPoints : "",
    isBonus: rubric.isBonus === true,
    settingsRows: rowsFromSettings(rubric.settings),
  };
}

/**
 * The identifying part of a stored version, kept while the modal shows or copies it.
 *
 * @param {Object|null} rubric - Rubric as returned by the backend
 * @returns {{id: number, rubricGroupId: number, versionNumber: string, name: string}|null}
 */
export function rubricSource(rubric) {
  return rubric
    ? { id: rubric.id, rubricGroupId: rubric.rubricGroupId, versionNumber: rubric.versionNumber, name: rubric.name }
    : null;
}

/**
 * Criterion version ids of a stored rubric, in the order of the rubric.
 *
 * @param {Object} rubric - Rubric as returned by the backend (`criteria`: `{criterionId, criterionPositionInRubric}`)
 * @returns {number[]}
 */
export function criterionIdsFromRubric(rubric) {
  return [...(rubric.criteria ?? [])]
    .sort((a, b) => a.criterionPositionInRubric - b.criterionPositionInRubric)
    .map((link) => link.criterionId);
}

/**
 * Request body of `rubricCreate`, and the content fields of `rubricCreateVersion`. A switched-off bound is `null`;
 * `defaultPoints` is only sent for a method that uses it; no version number.
 *
 * @param {Object} form - Form values
 * @param {number[]} criterionIds - Criterion version ids in order
 * @returns {Object} Payload fields
 */
export function toRubricPayload(form, criterionIds) {
  const { min, max } = activeBounds(form);
  return {
    name: form.name,
    description: form.description ?? "",
    minPoints: min,
    maxPoints: max,
    calculation: form.calculation,
    defaultPoints: usesDefaultPoints(form.calculation) && isNumber(form.defaultPoints) ? form.defaultPoints : null,
    isBonus: Boolean(form.isBonus),
    settings: settingsFromRows(form.settingsRows),
    criterionIds: [...criterionIds],
  };
}

/**
 * Body of `rubricCreateVersion`: the source version, its group and the full edited content.
 *
 * @param {Object} source - Version the user started from (`id`, `rubricGroupId`)
 * @param {Object} form - Form values
 * @param {number[]} criterionIds - Criterion version ids in order
 * @returns {Object}
 */
export function rubricVersionRequest(source, form, criterionIds) {
  return { rubricGroupId: source.rubricGroupId, copyFromId: source.id, ...toRubricPayload(form, criterionIds) };
}

/**
 * Check step 1 of the form.
 *
 * @param {Object} form - Form values
 * @returns {Object} Field → error key (`settings` → the object of validateSettingsRows); empty when valid
 */
export function validateRubricForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "required";
  else if (String(form.name).length > MAX_TEXT_LENGTH) errors.name = "tooLong";

  if (form.minActive && !isNumber(form.minPoints)) errors.minPoints = "number";
  if (form.maxActive && !isNumber(form.maxPoints)) errors.maxPoints = "number";
  const { min, max } = activeBounds(form);
  const range = boundsError(min, max);
  if (range && !errors.maxPoints) errors.maxPoints = range;

  if (usesDefaultPoints(form.calculation)) {
    if (isBlank(form.defaultPoints)) errors.defaultPoints = "required";
    else if (!isNumber(form.defaultPoints)) errors.defaultPoints = "number";
    else if ((min !== null && form.defaultPoints < min) || (max !== null && form.defaultPoints > max)) {
      errors.defaultPoints = min !== null && max !== null ? "pointsBetween" : min !== null ? "pointsAtLeast" : "pointsAtMost";
    }
  }

  const settings = validateSettingsRows(form.settingsRows);
  if (settings.general || Object.keys(settings.rows).length) errors.settings = settings;
  return errors;
}

/** Fields the backend names in `fieldRequired` / `fieldInvalid` that have an input in step 1. */
const STEP_ONE_FIELDS = new Set(["name", "description", "minPoints", "maxPoints", "calculation", "defaultPoints", "isBonus", "settings"]);

/**
 * The input a backend error belongs to, so it can be shown next to it.
 *
 * @param {Object} response - Backend error answer (`key`, `params`)
 * @returns {{field: string|null, step: number|null}} Field name (null when general) and the modal step (0 or 1);
 *   `step` is null for an error that belongs to neither step
 */
export function rubricErrorTarget(response) {
  const key = response?.key;
  if (key === "errors.assessment.pointsRange") return { field: "maxPoints", step: 0 };
  if (key?.startsWith("errors.assessment.settings")) return { field: "settings", step: 0 };
  if (["errors.assessment.rubric.criteriaNotFound", "errors.assessment.rubric.duplicateCriterion"].includes(key)) {
    return { field: null, step: 1 };
  }
  if (key === "errors.assessment.fieldRequired" || key === "errors.assessment.fieldInvalid") {
    const field = response.params?.field;
    if (field === "criterionIds") return { field: null, step: 1 };
    if (STEP_ONE_FIELDS.has(field)) return { field, step: 0 };
  }
  return { field: null, step: null };
}
