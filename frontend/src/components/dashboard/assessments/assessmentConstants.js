/**
 * Option lists for the assessment management dashboard.
 *
 * Values mirror the identifiers used by the assessment JSON configurations
 * (backend/db/migrations/*-basic-configuration-expose_*.json) and the score
 * calculation in utils/modules/assessment-score.
 *
 * @author Eyad Mohamed
 */

/**
 * Calculation methods a NEW rubric can choose.
 * `sum` (shown as "Summation") adds the criterion scores; `max` starts at defaultPoints and adds the criterion
 * scores (deduction-based rubrics), never going below zero.
 */
export const CALCULATION_METHODS = Object.freeze([
  { value: "sum", labelKey: "assessmentManagement.calculation.sum", usesDefaultPoints: false },
  { value: "max", labelKey: "assessmentManagement.calculation.max", usesDefaultPoints: true },
]);

/**
 * Calculation values that are no longer offered for new rubrics but may be stored in older ones. A stored
 * rubric keeps and shows its value (and a new version copied from it keeps it until the user changes it).
 * `min` capped the criterion sum at the rubric maximum.
 */
export const LEGACY_CALCULATION_METHODS = Object.freeze([
  { value: "min", labelKey: "assessmentManagement.calculation.min", usesDefaultPoints: false },
]);

/**
 * Whether a calculation method needs the defaultPoints field.
 *
 * @param {string} method - Calculation method value
 * @returns {boolean}
 */
export function usesDefaultPoints(method) {
  return CALCULATION_METHODS.some((m) => m.value === method && m.usesDefaultPoints);
}

/**
 * The options of the calculation select for a rubric whose current value is `current`: the methods of new
 * rubrics, plus the stored value when it is a legacy or unknown one (so it is shown and not lost).
 *
 * @param {string|null|undefined} current - Calculation value of the rubric being shown or copied
 * @returns {Array<{value: string, labelKey: string|null, usesDefaultPoints: boolean}>} `labelKey` is null for an
 *   unknown value, which is shown as it is
 */
export function calculationOptions(current) {
  const options = [...CALCULATION_METHODS];
  if (current && !options.some((m) => m.value === current)) {
    options.push(LEGACY_CALCULATION_METHODS.find((m) => m.value === current)
      ?? { value: current, labelKey: null, usesDefaultPoints: false });
  }
  return options;
}
