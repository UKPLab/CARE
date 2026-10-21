/**
 * Table-data preparation/transformation helpers for PublishAssessmentModal.vue.
 *
 * All functions take explicit arguments (no `this`, no Vuex store access). They are
 * not strictly pure: buildWorkflowsTable translates names via translateMaybeKey
 * (global i18n instance) and buildSessionsTable reads window.location.origin for
 * review links, both unchanged from the original component. Thin store-passthrough
 * computed properties are NOT part of this module and remain on the component.
 *
 * @author CARE Team
 */

import { translateMaybeKey } from "@/assets/utils.js";

export function buildOrderedWorkflowStepsByWorkflow(workflowSteps) {
  const grouped = workflowSteps.reduce((acc, step) => {
    if (!step) return acc;
    if (!acc[step.workflowId]) acc[step.workflowId] = [];
    acc[step.workflowId].push(step);
    return acc;
  }, {});

  const ordered = {};

  Object.keys(grouped).forEach((workflowId) => {
    const steps = grouped[workflowId];
    const nextMap = new Map(steps.map((s) => [s.workflowStepPrevious, s]));
    const sequence = [];
    const seen = new Set();

    let current = steps.find((s) => s.workflowStepPrevious === null);
    while (current && !seen.has(current.id)) {
      sequence.push(current);
      seen.add(current.id);
      current = nextMap.get(current.id);
    }

    // Append remaining steps (sorted) to avoid gaps in malformed chains
    const remaining = steps.filter((s) => !seen.has(s.id)).sort((a, b) => a.id - b.id);
    ordered[workflowId] = sequence.concat(remaining);
  });

  return ordered;
}

/**
 * @param {Object} params
 * @param {number|null} params.selectedConfigurationId
 * @param {Array} params.studies
 * @param {Array} params.workflows
 * @param {Array} params.studySteps
 * @param {Object} params.orderedWorkflowStepsByWorkflow
 * @param {Array} params.studySessions
 * @param {Function} params.getConfigurationIdFromConfig
 * @param {Function} params.isStudyClosed
 * @param {Function} params.t - i18n translate function
 */
export function buildWorkflowsTable({
  selectedConfigurationId,
  studies,
  workflows,
  studySteps,
  orderedWorkflowStepsByWorkflow,
  studySessions,
  getConfigurationIdFromConfig,
  isStudyClosed,
  t,
}) {
  const configId = selectedConfigurationId;
  if (!configId) {
    return [];
  }

  const workflowIdsInStudies = [
    ...new Set(studies.map((s) => s.workflowId).filter((id) => id !== null && id !== undefined)),
  ];

  const result = [];

  workflowIdsInStudies.forEach((workflowId) => {
    const workflow = workflows.find((w) => w.id === workflowId && !w.deleted);
    if (!workflow) return null;

    const studiesUsingWorkflow = studies.filter((s) => s.workflowId === workflowId);
    if (studiesUsingWorkflow.length === 0) return null;

    // Find study steps (actual instantiated steps) that use this configuration within these studies
    const studyIds = new Set(studiesUsingWorkflow.map((s) => s.id));
    const studyStepsForWorkflow = studySteps.filter((step) => {
      if (!step || step.deleted) return false;
      if (!studyIds.has(step.studyId)) return false;
      return getConfigurationIdFromConfig(step.configuration) === configId;
    });

    if (studyStepsForWorkflow.length === 0) return null;

    // Map to workflow step IDs and resolve their order/step numbers
    const orderedSteps = orderedWorkflowStepsByWorkflow[workflowId] || [];
    const workflowStepIdToStepNumber = orderedSteps.reduce((acc, step, idx) => {
      acc[step.id] = idx + 1;
      return acc;
    }, {});

    const stepNumberGroups = {};
    studyStepsForWorkflow.forEach((studyStep) => {
      const stepNum = workflowStepIdToStepNumber[studyStep.workflowStepId];

      if (stepNum) {
        if (!stepNumberGroups[stepNum]) {
          stepNumberGroups[stepNum] = [];
        }
        stepNumberGroups[stepNum].push(studyStep);
      }
    });
    // Create a separate row for each step number
    Object.keys(stepNumberGroups).forEach((stepNum) => {
      const studyStepsInThisStep = stepNumberGroups[stepNum];

      // Get all study IDs that have this step
      const studyIdsForThisStep = new Set(studyStepsInThisStep.map((s) => s.studyId));

      // Count sessions for these studies
      const sessionsForThisStep = studySessions.filter((session) => studyIdsForThisStep.has(session.studyId));

      // Determine if sessions are closed based on whether their study is closed
      const openSessions = sessionsForThisStep.filter((session) => {
        const study = studies.find((s) => s.id === session.studyId);
        return !isStudyClosed(study);
      }).length;
      const closedSessions = sessionsForThisStep.filter((session) => {
        const study = studies.find((s) => s.id === session.studyId);
        return isStudyClosed(study);
      }).length;

      result.push({
        id: result.length + 1,
        workflowId: workflow.id,
        workflowName: translateMaybeKey(workflow.name)
          || t("submission.publishAssessment.workflowFallback", { id: workflow.id }),
        stepNumber: parseInt(stepNum),
        description: translateMaybeKey(workflow.description) || "-",
        openSessions: openSessions,
        closedSessions: closedSessions,
        totalSessions: openSessions + closedSessions,
        studySteps: studyStepsInThisStep,
      });
    });
  });

  return result.sort((a, b) => {
    if (a.workflowName !== b.workflowName) {
      return a.workflowName.localeCompare(b.workflowName);
    }
    return a.stepNumber - b.stepNumber;
  });
}

/**
 * @param {Object} params
 * @param {Array} params.selectedWorkflows
 * @param {number|null} params.selectedConfigurationId
 * @param {Array} params.studySessions
 * @param {Array} params.studies
 * @param {Array} params.studySteps
 * @param {Array} params.documents
 * @param {Array} params.submissions
 * @param {Array} params.users
 * @param {Function} params.isStudyClosed
 * @param {Function} params.t - i18n translate function
 */
export function buildSessionsTable({
  selectedWorkflows,
  selectedConfigurationId,
  studySessions,
  studies,
  studySteps,
  documents,
  submissions,
  users,
  isStudyClosed,
  t,
}) {
  if (selectedWorkflows.length === 0 || !selectedConfigurationId) return [];

  // Collect all study steps from all selected workflows
  const allStudySteps = [];
  selectedWorkflows.forEach(selectedEntry => {
    if (selectedEntry && selectedEntry.studySteps) {
      allStudySteps.push(...selectedEntry.studySteps);
    }
  });

  if (allStudySteps.length === 0) return [];

  // Get all unique study IDs from selected workflows
  const matchingStudyIds = [...new Set(allStudySteps.map(s => s.studyId))];

  if (matchingStudyIds.length === 0) return [];

  return studySessions
    .filter((session) => {
      const study = studies.find((s) => s.id === session.studyId);
      // The study that the session belongs to needs to be closed and matches the workflow and configuration
      return isStudyClosed(study) && matchingStudyIds.includes(session.studyId)
    })
    .map((session) => {
      const study = studies.find((s) => s.id === session.studyId);
      const user = users.find((u) => u.id === session.userId);

      // Find related document and submission (prefer document with submissionId)
      const studyStepsForSession = studySteps.filter(
        (step) => step.studyId === session.studyId
      );
      const documentIds = studyStepsForSession.map((step) => step.documentId).filter(Boolean);
      let document = null;
      if (documentIds.length) {
        document =
          documents.find((d) => documentIds.includes(d.id) && d.submissionId) ||
          documents.find((d) => documentIds.includes(d.id)) ||
          null;
      }
      // Resolve parent document if needed
      if (document && !document.submissionId && document.parentDocumentId) {
        const parentDoc = documents.find((d) => d.id === document.parentDocumentId);
        if (parentDoc) {
          document = parentDoc;
        }
      }
      const submission =
        document?.submissionId &&
        submissions.find((s) => s.id === document.submissionId);

      // Get owner info from the study
      const owner = study
        ? users.find((u) => u.id === study.userId)
        : null;

      return {
        sessionId: session.id,
        studyId: session.studyId,
        studyName: study?.name || t("common.unknown"),
        userId: session.userId,
        firstName: user?.firstName || t("common.unknown"),
        lastName: user?.lastName || t("common.unknown"),
        userName: user?.userName || "-",
        ownerFirstName: owner?.firstName || "-",
        ownerLastName: owner?.lastName || "-",
        ownerUserName: owner?.userName || "-",
        ownerExtId: owner?.extId || "",
        submissionId: submission?.id || null,
        submissionExtId: submission?.extId || "",
        link: window.location.origin + "/review/" + session.hash,
        start: session.start,
        end: session.end,
        hash: session.hash,
      };
    });
}
