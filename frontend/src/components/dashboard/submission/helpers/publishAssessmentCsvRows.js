/**
 * Pure CSV row-building helpers for PublishAssessmentModal.vue.
 *
 * Builds the exact row objects handed to downloadObjectsAs(); download
 * orchestration (filename, toast) stays owned by the component.
 *
 * @author CARE Team
 */

/**
 * Build CSV rows for the exported sessions using assessmentScore utilities.
 * Each session becomes one row; criteria columns are derived from configuration.
 * Headers stay English so an export does not change with the UI language.
 *
 * @param {Object} params
 * @param {Array<Object>} params.sessions rows from publishAssessmentData (identity and scores resolved server-side)
 * @param {Array<string>} params.criteriaList
 * @param {Function} params.getAssessmentDataForSession - (session) => { scores, assessment }
 * @param {Function} params.getUserRoles - (userId) => string
 */
export function buildCsvRows({
  sessions,
  criteriaList,
  getAssessmentDataForSession,
  getUserRoles,
}) {
  return sessions.map((session) => {
    const { scores, assessment } = getAssessmentDataForSession(session);

    const row = {
      "User ExtId": session.ownerExtId || "",
      "User First Name": session.ownerFirstName || "",
      "User Last Name": session.ownerLastName || "",
      "User Name": session.ownerUserName || "",
      "Submission ID": session.submissionId || "",
      "Submission ExtId": session.submissionExtId || "",
      "Reviewer First Name": session.firstName || "",
      "Reviewer Last Name": session.lastName || "",
      "Reviewer User Name": session.userName || "",
      "Reviewer Roles": getUserRoles(session.userId),
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
