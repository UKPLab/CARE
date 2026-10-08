/**
 * Pure CSV row-building helpers for PublishAssessmentModal.vue.
 *
 * Builds the exact row objects handed to downloadObjectsAs(); download
 * orchestration (filename, toast) stays owned by the component.
 *
 * @author CARE Team
 */

/**
 * Build CSV rows for selected sessions using assessmentScore utilities.
 * Each session becomes one row; criteria columns are derived from configuration.
 *
 * @param {Object} params
 * @param {Array} params.selectedSessions
 * @param {Array} params.criteriaList
 * @param {Array} params.submissions
 * @param {Function} params.getAssessmentDataForSession - (session) => { scores, assessment }
 * @param {Function} params.getReviewerUserForSession - (session) => user|null
 * @param {Function} params.getOwnerUserForSession - (session) => user|null
 * @param {Function} params.getUserRoles - (userId) => string
 */
export function buildCsvRows({
  selectedSessions,
  criteriaList,
  submissions,
  getAssessmentDataForSession,
  getReviewerUserForSession,
  getOwnerUserForSession,
  getUserRoles,
}) {
  return selectedSessions.map((session) => {
    const { scores, assessment } = getAssessmentDataForSession(session);
    const reviewer = getReviewerUserForSession(session);
    const ownerUser = getOwnerUserForSession(session);
    const submission = session.submissionId ? submissions.find((s) => s.id === session.submissionId) : null;

    const row = {
      "User ExtId": ownerUser?.extId || session.ownerExtId || "",
      "User First Name": ownerUser?.firstName || session.ownerFirstName || "",
      "User Last Name": ownerUser?.lastName || session.ownerLastName || "",
      "User Name": ownerUser?.userName || session.ownerUserName || "",
      "Submission ID": session.submissionId || "",
      "Submission ExtId": submission?.extId || "",
      "Reviewer First Name": reviewer?.firstName || "",
      "Reviewer Last Name": reviewer?.lastName || "",
      "Reviewer User Name": reviewer?.userName || "",
      "Reviewer Roles": reviewer ? getUserRoles(reviewer.id) : "",
      "Hash": session.hash || "",
      "Total Points": assessment.achieved_points ?? 0,
    };

    // Add dynamic criteria columns
    criteriaList.forEach((criterionName) => {
      row[criterionName] = scores[criterionName] ?? 0;
    });

    return row;
  });
}
