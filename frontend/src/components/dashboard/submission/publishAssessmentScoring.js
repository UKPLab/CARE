/**
 * Scoring/grade-mapping helpers for PublishAssessmentModal.vue.
 *
 * All functions take explicit arguments (no `this`, no direct Vuex/socket access);
 * store data is supplied by the caller, e.g. getAssessmentDataForSession's
 * documentDataGetter.
 *
 * getNlpServiceForStudyStep and getAssessmentDataKeys have no callers (they were
 * already unused in the original component) and are kept here unchanged.
 *
 * @author CARE Team
 */

import { ASSESSMENT_RESULT_KEY, getAssessmentResultKeyCandidates } from "@/assets/serviceDocumentDataKeys.js";
import { calculateAssessmentScore, buildScoresFromState } from "assessment-score";

export function isStudyClosed(study) {
  if (!study) {
    return false;
  }
  return study.closed !== null ? true : false;
}

/**
 * Resolve the configuration ID referenced by a study step's configuration object.
 */
export function getConfigurationIdFromConfig(cfg) {
  if (!cfg) return null;
  return (
    cfg?.settings?.configurationId ||
    cfg?.configurationId ||
    null
  );
}

export function getNlpServiceForStudyStep(studyStep) {
  if (!studyStep || !studyStep.configuration) return null;
  const cfg = studyStep.configuration;
  if (!cfg || !Array.isArray(cfg.services) || !cfg.services.length) return null;

  // Find any configured NLP skill or AI hook.
  const svc = cfg.services.find((s) => s.skill || s.hookId) || cfg.services[0];

  return svc || null;
}

/**
 * Get assessment data key for a study step.
 * Returns canonical AI/NLP keys, otherwise "assessment_result".
 */
export function getAssessmentDataKeys(studyStep) {
  const svc = getNlpServiceForStudyStep(studyStep);
  const keys = getAssessmentResultKeyCandidates(svc);
  return keys.length ? keys : [ASSESSMENT_RESULT_KEY];
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
 * @param {Function} documentDataGetter - (studySessionId) => document_data rows for that session
 * @param {Object} configContent
 */
export function getAssessmentDataForSession(session, selectedWorkflows, documentDataGetter, configContent) {
  // Search across all selected workflows to find the matching study step
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
  // fetch document_data for this session and study step
  // Try both AI workflow keys and non-AI key (assessment_result)
  const documentDataArray = documentDataGetter(session.sessionId);
  const documentDataItem = documentDataArray.find(
    (dd) => dd?.studyStepId === matchingStudyStep.id && dd?.key === ASSESSMENT_RESULT_KEY
  );
  const assessmentRaw = documentDataItem?.value || {};

  const scoreState = assessmentRaw || {};
  const scores = buildScoresFromState(scoreState);
  const assessment = calculateAssessmentScore(configContent, scores);

  return { scores, assessment };
}
