/**
 * Scoring/grade-mapping helpers for PublishAssessmentModal.vue.
 *
 * All functions take explicit arguments (no `this`, no direct Vuex/socket access);
 * store data is supplied by the caller, e.g. getAssessmentDataForSession's
 * documentData getters.
 *
 * @author CARE Team
 */

import { ASSESSMENT_RESULT_KEY, getAssessmentResultKeyCandidates } from "@/assets/serviceDocumentDataKeys.js";
import { calculateAssessmentScore, pickScoresFromGradeRows } from "assessment-score";

export function isStudyClosed(study) {
  if (!study) {
    return false;
  }
  return study.closed !== null ? true : false;
}

/**
 * Resolve the assessment configuration id linked to a study step configuration.
 * Prefers settings.configurationId; falls back to a top-level configurationId.
 */
export function getConfigurationIdFromConfig(cfg) {
  if (!cfg) return null;
  return (
    cfg?.settings?.configurationId ||
    cfg?.configurationId ||
    null
  );
}

/**
 * Pick the NLP or AI hook service from a study step configuration.
 * Prefers a service with skill or hookId; otherwise uses the first entry.
 */
export function getNlpServiceForStudyStep(studyStep) {
  if (!studyStep || !studyStep.configuration) return null;
  const cfg = studyStep.configuration;
  if (!cfg || !Array.isArray(cfg.services) || !cfg.services.length) return null;

  const svc = cfg.services.find((s) => s.skill || s.hookId) || cfg.services[0];
  return svc || null;
}

/**
 * Get assessment data keys for a study step.
 * Always adds assessment_result to the hook/NLP keys.
 */
export function getAssessmentDataKeys(studyStep) {
  const svc = getNlpServiceForStudyStep(studyStep);
  const keys = getAssessmentResultKeyCandidates(svc);
  return [...new Set([...keys, ASSESSMENT_RESULT_KEY])];
}

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
 * Retrieves assessment data for a given session.
 * Returns an object with scores and assessment calculation.
 *
 * @param {Object} session
 * @param {Array} selectedWorkflows
 * @param {Object} documentData
 * @param {Function} documentData.getBySession - (studySessionId) => document_data rows for that session
 * @param {Function} documentData.getAll - () => all document_data rows
 * @param {Object} configContent
 */
export function getAssessmentDataForSession(session, selectedWorkflows, documentData, configContent) {
  let matchingStudyStep = null;
  for (const selectedEntry of selectedWorkflows) {
    if (selectedEntry && selectedEntry.studySteps) {
      matchingStudyStep = selectedEntry.studySteps.find(
        step => step.studyId === session.studyId
      );
      if (matchingStudyStep) break;
    }
  }

  if (!matchingStudyStep) {
    return { scores: {}, assessment: {} };
  }

  const keys = getAssessmentDataKeys(matchingStudyStep);
  const bySession = documentData.getBySession(session.sessionId) || [];
  const items = bySession.filter(
    (row) =>
      (row?.studyStepId == null || row?.studyStepId === matchingStudyStep.id)
      && keys.includes(row?.key)
  );
  let scores = pickScoresFromGradeRows(items);
  // Same fallback rule as the grade export: use document-level hook rows when the session rows have no scores.
  if (!Object.keys(scores).length) {
    const documentId = Number(matchingStudyStep.documentId);
    const documentRows = (documentData.getAll() || []).filter(
      (row) =>
        row.studySessionId == null
        && Number(row.documentId) === documentId
        && keys.includes(row?.key)
    );
    scores = pickScoresFromGradeRows(documentRows);
  }
  const assessment = calculateAssessmentScore(configContent, scores);

  return { scores, assessment };
}
