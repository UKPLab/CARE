/**
 * Scoring/grade-mapping helpers for PublishAssessmentModal.vue.
 *
 * All functions take explicit arguments (no `this`, no direct Vuex/socket access).
 * Which grade rows count for a session (saved assessment row, hook/NLP rows,
 * document-level fallback) is decided server-side by publishAssessmentData
 *
 * @author CARE Team
 */

import { calculateAssessmentScore } from "assessment-score";

/**
 * Calculates the linear conversion factor between assessment points and Moodle grade.
 * Uses the same logic for both the overview display and the actual grade publishing.
 */
export function getConversionFactorFromAssessment(assessment, assignmentMaxGrade) {
  const totalMaxPoints = assessment.total_max_points ?? 0;
  const totalMinPoints = assessment.total_min_points ?? 0;
  const maxGrade = assignmentMaxGrade || 0;

  const sourcePointsRange = totalMaxPoints - totalMinPoints;
  const targetGradeRange = maxGrade - 0;

  if (maxGrade > 0 && sourcePointsRange > 0) {
    let factor = targetGradeRange / sourcePointsRange;
    // Keep 3 decimal places for display and internal use
    factor = Math.round(factor * 1000000) / 1000000;
    return factor;
  }

  return 0;
}

/**
 * Converts an assessment score from one scale to another.
 * Uses the same conversionFactor that is shown in the overview:
 *   convertedGrade = normalizedPoints * conversionFactor
 * and then rounds the result to 2 decimal places.
 */
export function convertAssessmentScore(assessment, assignmentMaxGrade) {
  const { total_min_points, achieved_points } = assessment;

  const conversionFactor = getConversionFactorFromAssessment(assessment, assignmentMaxGrade);
  const normalizedPoints = achieved_points - (total_min_points ?? 0);
  const convertedGrade = normalizedPoints * conversionFactor;
  // Round final grade to 2 decimal places
  return Math.round(convertedGrade * 100) / 100;
}

/**
 * Scores and total for one exported session.
 *
 * @param {Object} session row from publishAssessmentData (needs studyStepId / scores)
 * @param {Object} configContent selected assessment configuration content
 * @returns {{scores: Object, assessment: Object}}
 */
export function getAssessmentDataForSession(session, configContent) {
  if (!session?.studyStepId) {
    return { scores: {}, assessment: {} };
  }
  const scores = session.scores && typeof session.scores === "object" ? session.scores : {};
  return { scores, assessment: calculateAssessmentScore(configContent, scores) };
}
