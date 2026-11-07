/**
 * In-memory store for the assessment management prototype.
 *
 * This module is the only place that knows the data is local. The dashboard and
 * modals call the functions below; to move to the database, replace their bodies
 * with socket calls and keep the signatures. Relationships are id lists, so a
 * criterion shared by several rubrics is stored once and an edit shows up everywhere.
 *
 * @author Eyad Mohamed
 */
import { reactive } from "vue";
import { createSeedData } from "./assessmentMockData.js";

const state = reactive(createSeedData());

const nextId = (list) => list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Reactive state (read-only use in computed properties). */
export const assessmentState = state;

/**
 * Add or update a record in a collection.
 *
 * @param {Array} list - Collection in the store
 * @param {Object} data - Record data; `id` set means update
 * @returns {Object} The stored record
 */
function upsert(list, data) {
  const payload = clone(data);
  const existing = payload.id ? list.find((r) => r.id === payload.id) : null;
  if (existing) {
    Object.assign(existing, payload);
    return existing;
  }
  payload.id = nextId(list);
  list.push(payload);
  return payload;
}

/**
 * Create or update an assessment.
 *
 * @param {Object} data - Assessment with rubricIds in display order
 * @returns {Object} Stored assessment
 */
export function saveAssessment(data) {
  return upsert(state.assessments, data);
}

/**
 * Create or update a rubric.
 *
 * @param {Object} data - Rubric with criterionIds in display order
 * @returns {Object} Stored rubric
 */
export function saveRubric(data) {
  return upsert(state.rubrics, data);
}

/**
 * Create or update a criterion. Shared by every rubric that references its id.
 *
 * @param {Object} data - Criterion with scoring options
 * @returns {Object} Stored criterion
 */
export function saveCriterion(data) {
  return upsert(state.criteria, data);
}

/**
 * Delete an assessment. Rubrics are kept.
 *
 * @param {number} id - Assessment id
 */
export function deleteAssessment(id) {
  state.assessments.splice(state.assessments.findIndex((a) => a.id === id), 1);
}

/**
 * Delete a rubric and remove it from every assessment. Criteria are kept.
 *
 * @param {number} id - Rubric id
 */
export function deleteRubric(id) {
  state.rubrics.splice(state.rubrics.findIndex((r) => r.id === id), 1);
  state.assessments.forEach((a) => {
    a.rubricIds = a.rubricIds.filter((rid) => rid !== id);
  });
}

/**
 * Delete a criterion and remove it from every rubric.
 *
 * @param {number} id - Criterion id
 */
export function deleteCriterion(id) {
  state.criteria.splice(state.criteria.findIndex((c) => c.id === id), 1);
  state.rubrics.forEach((r) => {
    r.criterionIds = r.criterionIds.filter((cid) => cid !== id);
  });
}

/**
 * Assessments that reference a rubric.
 *
 * @param {number} rubricId - Rubric id
 * @returns {Array} Assessments
 */
export function assessmentsUsingRubric(rubricId) {
  return state.assessments.filter((a) => a.rubricIds.includes(rubricId));
}

/**
 * Rubrics that reference a criterion.
 *
 * @param {number} criterionId - Criterion id
 * @returns {Array} Rubrics
 */
export function rubricsUsingCriterion(criterionId) {
  return state.rubrics.filter((r) => r.criterionIds.includes(criterionId));
}

/**
 * Deep copy of a record for use as an editable form.
 *
 * @param {Object} record - Store record
 * @returns {Object} Detached copy
 */
export function cloneRecord(record) {
  return clone(record);
}
