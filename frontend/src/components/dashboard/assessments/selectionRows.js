/**
 * Rows of the version selection tables (criteria of a rubric, rubrics of an assessment). A row is ONE VERSION: its
 * `id` is the version id that the backend stores, so the selection is pinned to exactly that version. Soft-deleted
 * versions are never returned by the backend, so they are never offered.
 *
 * No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Text of a point range; a missing bound is open.
 *
 * @param {number|null} min
 * @param {number|null} max
 * @returns {string} "min – max", "≥ min", "≤ max" or "–"
 */
export function formatRange(min, max) {
  if (isNumber(min) && isNumber(max)) return `${min} – ${max}`;
  if (isNumber(min)) return `≥ ${min}`;
  if (isNumber(max)) return `≤ ${max}`;
  return "–";
}

/**
 * Row of one criterion or rubric version.
 *
 * @param {Object} version - Version with `id`, `name`, `versionNumber`, `minPoints`, `maxPoints`
 * @returns {{id: number, name: string, versionNumber: string, detail: string, points: string}}
 */
export function versionRow(version) {
  return {
    id: version.id,
    name: version.name,
    versionNumber: version.versionNumber,
    detail: `v${version.versionNumber}`,
    points: formatRange(version.minPoints ?? null, version.maxPoints ?? null),
  };
}

/**
 * Rows of the available versions, ordered by name, then newest version first.
 *
 * @param {Object[]} versions - All live versions as returned by `criterionGetAll` / `rubricGetAll`
 * @returns {Object[]}
 */
export function versionRows(versions) {
  return versions
    .map(versionRow)
    .sort((a, b) => a.name.localeCompare(b.name) || b.id - a.id);
}

/**
 * Rows of the criteria of a stored rubric (read-only list), in the order of the rubric.
 *
 * @param {Object} rubric - Rubric with `criteria`: `{criterionId, criterionPositionInRubric, criterion}`
 * @returns {Object[]}
 */
export function rowsFromRubricCriteria(rubric) {
  return [...(rubric.criteria ?? [])]
    .sort((a, b) => a.criterionPositionInRubric - b.criterionPositionInRubric)
    .map((link) => versionRow({ ...link.criterion, id: link.criterionId }));
}

/**
 * Rows of the rubrics of a stored assessment (read-only list), in the order of the assessment.
 *
 * @param {Object} assessment - Assessment with `rubrics`: `{rubricId, rubricPositionInAssessment, rubric}`
 * @returns {Object[]}
 */
export function rowsFromAssessmentRubrics(assessment) {
  return [...(assessment.rubrics ?? [])]
    .sort((a, b) => a.rubricPositionInAssessment - b.rubricPositionInAssessment)
    .map((link) => versionRow({ ...link.rubric, id: link.rubricId }));
}
