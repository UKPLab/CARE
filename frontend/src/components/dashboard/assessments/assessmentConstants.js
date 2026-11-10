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
 * Rubric calculation methods.
 * `min` caps the criterion sum at the rubric maximum; `max` starts at defaultPoints and
 * adds the criterion scores (deduction-based rubrics), never going below zero.
 */
export const CALCULATION_METHODS = Object.freeze([
  { value: "sum", labelKey: "assessmentManagement.calculation.sum", usesDefaultPoints: false },
  { value: "min", labelKey: "assessmentManagement.calculation.min", usesDefaultPoints: false },
  { value: "max", labelKey: "assessmentManagement.calculation.max", usesDefaultPoints: true },
]);

/** Criterion grading functions found in the existing configurations. */
export const GRADING_FUNCTIONS = Object.freeze([
  { value: "auto_grading", labelKey: "assessmentManagement.gradingFunction.auto_grading" },
  { value: "manual_grading", labelKey: "assessmentManagement.gradingFunction.manual_grading" },
  { value: "check_latex_metadata", labelKey: "assessmentManagement.gradingFunction.check_latex_metadata" },
  { value: "check_latex_template", labelKey: "assessmentManagement.gradingFunction.check_latex_template" },
  { value: "check_pdf_pages", labelKey: "assessmentManagement.gradingFunction.check_pdf_pages" },
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
