/**
 * Table-data preparation helpers for PublishAssessmentModal.vue.
 *
 * All functions take explicit arguments (no `this`, no Vuex store access). The
 * workflow × step rows and their session counts come from the server
 * (publishAssessmentWorkflows); the session rows are queried by BackendTable.
 * and sessionReviewLink reads window.location.origin.
 *
 * @author CARE Team
 */

import { translateMaybeKey } from "@/assets/utils.js";

/**
 * Review link of a study session.
 * @param {string} hash study session hash
 * @returns {string}
 */
export function sessionReviewLink(hash) {
  return `${window.location.origin}/review/${hash}`;
}

/**
 * Rows of the workflow step table: one per workflow step running the selected configuration.
 *
 * @param {Object} params
 * @param {Array<{workflowId: number, stepNumber: number, openSessions: number, closedSessions: number}>} params.workflowRows
 *   rows from publishAssessmentWorkflows
 * @param {Array} params.workflows workflow table rows, for names and descriptions
 * @param {Function} params.t - i18n translate function
 */
export function buildWorkflowsTable({ workflowRows, workflows, t }) {
  return workflowRows
    .map((row) => {
      const workflow = workflows.find((w) => w.id === row.workflowId && !w.deleted);
      return {
        workflowId: row.workflowId,
        workflowName: translateMaybeKey(workflow?.name)
          || t("submission.publishAssessment.workflowFallback", { id: row.workflowId }),
        stepNumber: row.stepNumber,
        description: translateMaybeKey(workflow?.description) || "-",
        openSessions: row.openSessions,
        closedSessions: row.closedSessions,
        totalSessions: row.openSessions + row.closedSessions,
      };
    })
    .sort((a, b) => {
      if (a.workflowName !== b.workflowName) {
        return a.workflowName.localeCompare(b.workflowName);
      }
      return a.stepNumber - b.stepNumber;
    })
    .map((row, index) => ({
      ...row,
      id: index + 1,
    }));
}
