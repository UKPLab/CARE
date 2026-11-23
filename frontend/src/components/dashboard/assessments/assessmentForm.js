/**
 * Form model of the assessment modal: defaults, mapping from and to the backend contract (`assessmentCreate`,
 * `assessmentCreateVersion`, `assessmentGet`) and the checks that run before a request.
 *
 * An assessment has a name and a description; its rubrics are chosen by rubric VERSION ids, in order. There is no
 * version number to enter (the backend assigns it) and the predecessor link between versions is maintained by the
 * backend: the frontend never sends one.
 *
 * Error values are keys relative to `assessmentManagement.errors`. No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */
import { MAX_TEXT_LENGTH } from "./criterionForm.js";

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

/** @returns {{name: string, description: string}} empty form of a new assessment */
export function emptyAssessmentForm() {
  return { name: "", description: "" };
}

/**
 * Form values of a stored assessment version.
 *
 * @param {Object} assessment - Assessment as returned by the backend
 * @returns {{name: string, description: string}}
 */
export function formFromAssessment(assessment) {
  return { name: assessment.name ?? "", description: assessment.description ?? "" };
}

/**
 * The identifying part of a stored version, kept while the modal shows or copies it.
 *
 * @param {Object|null} assessment - Assessment as returned by the backend
 * @returns {{id: number, assessmentGroupId: number, versionNumber: string, name: string}|null}
 */
export function assessmentSource(assessment) {
  return assessment
    ? { id: assessment.id, assessmentGroupId: assessment.assessmentGroupId, versionNumber: assessment.versionNumber, name: assessment.name }
    : null;
}

/**
 * Rubric version ids of a stored assessment, in the order of the assessment.
 *
 * @param {Object} assessment - Assessment as returned by the backend (`rubrics`: `{rubricId, rubricPositionInAssessment}`)
 * @returns {number[]}
 */
export function rubricIdsFromAssessment(assessment) {
  return [...(assessment.rubrics ?? [])]
    .sort((a, b) => a.rubricPositionInAssessment - b.rubricPositionInAssessment)
    .map((link) => link.rubricId);
}

/**
 * Request body of `assessmentCreate`, and the content fields of `assessmentCreateVersion`. No version number and no
 * predecessor: both are the backend's business.
 *
 * @param {{name: string, description: string}} form
 * @param {number[]} rubricIds - Rubric version ids in order
 * @returns {Object}
 */
export function toAssessmentPayload(form, rubricIds) {
  return { name: form.name, description: form.description ?? "", rubricIds: [...rubricIds] };
}

/**
 * Body of `assessmentCreateVersion`: the source version, its group and the full edited content.
 *
 * @param {Object} source - Version the user started from (`id`, `assessmentGroupId`)
 * @param {{name: string, description: string}} form
 * @param {number[]} rubricIds - Rubric version ids in order
 * @returns {Object}
 */
export function assessmentVersionRequest(source, form, rubricIds) {
  return { assessmentGroupId: source.assessmentGroupId, copyFromId: source.id, ...toAssessmentPayload(form, rubricIds) };
}

/**
 * Check step 1 of the form.
 *
 * @param {{name: string}} form
 * @returns {Object} Field → error key; empty when valid
 */
export function validateAssessmentForm(form) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "required";
  else if (String(form.name).length > MAX_TEXT_LENGTH) errors.name = "tooLong";
  return errors;
}

/**
 * The input a backend error belongs to.
 *
 * @param {Object} response - Backend error answer (`key`, `params`)
 * @returns {{field: string|null, step: number|null}}
 */
export function assessmentErrorTarget(response) {
  const key = response?.key;
  if (["errors.assessment.assessment.rubricsNotFound", "errors.assessment.assessment.duplicateRubric"].includes(key)) {
    return { field: null, step: 1 };
  }
  if (key === "errors.assessment.fieldRequired" || key === "errors.assessment.fieldInvalid") {
    const field = response.params?.field;
    if (field === "rubricIds") return { field: null, step: 1 };
    if (field === "name" || field === "description") return { field, step: 0 };
  }
  return { field: null, step: null };
}
