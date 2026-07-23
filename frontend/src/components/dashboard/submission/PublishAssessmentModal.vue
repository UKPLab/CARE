<template>
  <StepperModal
    ref="assessmentStepper"
    size="xl"
    :steps="steps"
    :validation="stepValid"
    @submit="handleSubmit"
  >
    <template #title>
      <h5 class="modal-title">{{ $t("submission.publishAssessment.title") }}</h5>
    </template>

    <!-- STEP 1: Configuration Selection -->
    <template #step-1>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectConfiguration") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectConfigurationDescription") }}
        </p>
        <BasicTable
          v-model="selectedConfigurations"
          :data="configurationsTable"
          :columns="configurationTableColumns"
          :options="singleSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 2: Workflow Selection -->
    <template #step-2>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectWorkflows") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectWorkflowsDescription") }}
        </p>
        <BasicTable
          v-model="selectedWorkflows"
          :data="workflowsTable"
          :columns="workflowTableColumns"
          :options="multiSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 3: Session Selection -->
    <template #step-3>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectSessions") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectSessionsDescriptionPrefix") }}
          <strong>{{ $t("submission.publishAssessment.closedStudySessions") }}</strong>
          {{ $t("submission.publishAssessment.selectSessionsDescriptionSuffix") }}
        </p>
        <div v-if="sessionsTable.length === 0" class="alert alert-warning">
          {{ $t("submission.publishAssessment.noSessionsFound") }}
        </div>
        <BasicTable
          v-else
          v-model="selectedSessions"
          :data="sessionsTable"
          :columns="sessionTableColumns"
          :options="multiSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 4: Confirmation -->
    <template #step-4>
      <div class="mb-3">
        <label
          for="linkCollection"
          class="form-label"
        ><b>{{ $t("submission.publishAssessment.hashCollection") }}</b></label>
        <select
          id="linkCollection"
          v-model="linkCollection"
          class="form-select"
        >
          <option value="studies">{{ $t("submission.publishAssessment.hashCollectionStudies") }}</option>
          <option value="sessions">{{ $t("submission.publishAssessment.hashCollectionSessions") }}</option>
        </select>
      </div>
      <div class="mb-3">
        <p><b>{{ $t("submission.publishAssessment.hashes") }}</b></p>
        <ul v-if="linkCollection === 'studies'">
          <li
            v-for="study in formattedStudies"
            :key="study.study.id"
          >
            <b>{{ study.study.name }} ({{ study.study.ownerFirstName }} {{ study.study.ownerLastName }})</b>
            <ul>
              <li
                v-for="session in study.sessions"
                :key="session.sessionId"
              >
                {{ session.firstName }} {{ session.lastName }} (<a
                  :href="session.link"
                  target="_blank"
                >{{ session.hash }}</a>)
              </li>
            </ul>
          </li>
        </ul>
        <ul v-else-if="linkCollection === 'sessions'">
          <li
            v-for="(sessions, odx) in formattedSessions"
            :key="odx"
          >
            <b>{{ sessions[0].firstName }} {{ sessions[0].lastName }}</b>
            <ul>
              <li
                v-for="s in sessions"
                :key="s.sessionId"
              >
                {{ s.studyName }} (<a
                  :href="s.link"
                  target="_blank"
                >{{ s.hash }}</a>)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>

    <!-- STEP 5: Publishing Options -->
    <template #step-5>
      <div class="mb-3">
        <label for="publishMethod" class="form-label"><b>{{ $t("submission.publishAssessment.publishingMethod") }}</b></label>
        <select
          id="publishMethod"
          v-model="publishMethod"
          class="form-select"
        >
          <option
            v-for="opt in publishMethodOptions"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div v-if="publishMethod === 'moodle'">
        <div class="mb-3">
          <div class="form-check">
            <input
              id="reviewUrl"
              v-model="isReviewUrlIncluded"
              class="form-check-input"
              type="checkbox"
            >
            <label
              class="form-check-label"
              for="reviewUrl"
            >
              <b>{{ $t("submission.publishAssessment.includeReviewUrl") }}</b>
            </label>
            <p class="small text-muted mt-1">
              {{ $t("submission.publishAssessment.includeReviewUrlDescription") }}
            </p>
          </div>
        </div>
        <MoodleOptions
          ref="moodleOptionsForm"
          v-model="moodleOptions"
          with-assignment-id
          @select-assignment="selectAssignment"
        />
        <div
          v-if="selectedSessions.length > 0 && selectedConfigurationContent"
          class="mt-4"
        >
          <label class="form-label"><b>{{ $t("submission.publishAssessment.moodleGradePublishingOverview") }}</b></label>
          <div class="card">
            <div class="card-body">
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.numberOfGradesToPublish") }}</strong>
                </div>
                <div class="col-6">
                  {{ gradeInformation.numberOfGrades }}
                </div>
              </div>
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.assessmentScaleCurrentScores") }}</strong>
                </div>
                <div class="col-6">
                  {{ $t("submission.publishAssessment.pointsRange", {
                    from: gradeInformation.totalMinPoints,
                    to: gradeInformation.totalMaxPoints
                  }) }}
                </div>
              </div>
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.moodleGradeScaleTarget") }}</strong>
                </div>
                <div class="col-6">
                  <template v-if="moodleOptions?.assignmentID">
                    {{ $t("submission.publishAssessment.pointsRange", {
                      from: 0,
                      to: gradeInformation.maxGradeFromMoodle
                    }) }}
                  </template>
                  <template v-else>
                    {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
                  </template>
                </div>
              </div>
              <div class="row">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.conversionFactor") }}</strong>
                </div>
                <div class="col-6">
                  <template v-if="moodleOptions?.assignmentID">
                    {{ $t("submission.publishAssessment.conversionFactorValue", {
                      factor: gradeInformation.conversionFactor
                    }) }}
                  </template>
                  <template v-else>
                    {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
                  </template>
                </div>
              </div>
            </div>
          </div>
          <p class="small text-muted mt-2">
            <em>
              {{ $t("submission.publishAssessment.conversionNote") }}
            </em>
          </p>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { calculateAssessmentScore, buildScoresFromState } from "assessment-score";
import { downloadObjectsAs, resolveApiMessage, translateMaybeKey } from "@/assets/utils.js";
import {
  ASSESSMENT_RESULT_KEY,
  getAssessmentResultKeyCandidates,
} from "@/assets/serviceDocumentDataKeys.js";

/**
 * Modal for publishing assessment data with CSV export
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentModal",
  components: { BasicTable, StepperModal, MoodleOptions },
  subscribeTable: [
    { table: "workflow" },
    { table: "workflow_step" },
    { table: "configuration", filter: [{ key: "type", value: 0 }] },
    { table: "study" },
    { table: "study_step" },
    { table: "study_session" },
    { table: "submission" },
    { table: "document" },
    { table: "document_data" },
    { table: "user" },
    { table: "user_role" },
    { table: "user_role_matching" },
  ],
  data() {
    return {
      selectedWorkflows: [],
      selectedConfigurations: [],
      selectedSessions: [],
      publishMethod: "csv",
      linkCollection: "studies",
      selectedAssignmentMaxGrade: 0, // Store max grade for selected assignment
      isReviewUrlIncluded: false, // Option to include review URL in Moodle feedback
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("submission.publishAssessment.steps.configuration") },
        { title: this.$t("submission.publishAssessment.steps.workflow") },
        { title: this.$t("submission.publishAssessment.steps.session") },
        { title: this.$t("submission.publishAssessment.steps.confirmation") },
        { title: this.$t("submission.publishAssessment.steps.publishing") },
      ];
    },
    stepValid() {
      return [
        this.selectedConfigurations.length > 0,
        this.selectedWorkflows.length > 0,
        this.selectedSessions.length > 0,
        true,
        true,
      ];
    },
    singleSelectTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        singleSelect: true,
        pagination: 10,
        search: true,
      };
    },
    multiSelectTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: 10,
        search: true,
      };
    },
    // Data sources
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    workflows() {
      return this.$store.getters["table/workflow/getAll"] || [];
    },
    workflowSteps() {
      return this.$store.getters["table/workflow_step/getAll"] || [];
    },
    configurations() {
      return this.$store.getters["table/configuration/getFiltered"](
        (c) => c.type === 0 && !c.deleted
      ) || [];
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"](
        (s) => !s.template && s.projectId === this.projectId
      ) || [];
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"] || [];
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"] || [];
    },
    submissions() {
      return this.$store.getters["table/submission/getFiltered"](
        (s) => s.projectId === this.projectId
      ) || [];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](
        (d) => d.projectId === this.projectId
      ) || [];
    },
    users() {
      return this.$store.getters["table/user/getAll"] || [];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"] || [];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"] || [];
    },
    orderedWorkflowStepsByWorkflow() {
      const grouped = this.workflowSteps.reduce((acc, step) => {
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
    },

    // Table data
    workflowsTable() {
      const configId = this.selectedConfigurationId;
      if (!configId) {
        return [];
      }

      const workflowIdsInStudies = [
        ...new Set(this.studies.map((s) => s.workflowId).filter((id) => id !== null && id !== undefined)),
      ];

      const result = [];

      workflowIdsInStudies.forEach((workflowId) => {
        const workflow = this.workflows.find((w) => w.id === workflowId && !w.deleted);
        if (!workflow) return null;

        const studiesUsingWorkflow = this.studies.filter((s) => s.workflowId === workflowId);
        if (studiesUsingWorkflow.length === 0) return null;

        // Find study steps (actual instantiated steps) that use this configuration within these studies
        const studyIds = new Set(studiesUsingWorkflow.map((s) => s.id));
        const studyStepsForWorkflow = this.studySteps.filter((step) => {
          if (!step || step.deleted) return false;
          if (!studyIds.has(step.studyId)) return false;
          return this.getConfigurationIdFromConfig(step.configuration) === configId;
        });

        if (studyStepsForWorkflow.length === 0) return null;

        // Map to workflow step IDs and resolve their order/step numbers
        const orderedSteps = this.orderedWorkflowStepsByWorkflow[workflowId] || [];
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
          const sessionsForThisStep = this.studySessions.filter((session) => studyIdsForThisStep.has(session.studyId));

          // Determine if sessions are closed based on whether their study is closed
          const openSessions = sessionsForThisStep.filter((session) => {
            const study = this.studies.find((s) => s.id === session.studyId);
            return !this.isStudyClosed(study);
          }).length;
          const closedSessions = sessionsForThisStep.filter((session) => {
            const study = this.studies.find((s) => s.id === session.studyId);
            return this.isStudyClosed(study);
          }).length;

          result.push({
            id: result.length + 1,
            workflowId: workflow.id,
            workflowName: translateMaybeKey(workflow.name)
              || this.$t("submission.publishAssessment.workflowFallback", { id: workflow.id }),
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
    },
    workflowTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("submission.publishAssessment.columns.workflowId"), key: "workflowId" },
        { name: this.$t("submission.publishAssessment.columns.workflowName"), key: "workflowName" },
        { name: this.$t("submission.publishAssessment.columns.step"), key: "stepNumber" },
        { name: this.$t("submission.publishAssessment.columns.openSessions"), key: "openSessions" },
        { name: this.$t("submission.publishAssessment.columns.closedSessions"), key: "closedSessions" },
        { name: this.$t("submission.publishAssessment.columns.totalSessions"), key: "totalSessions" },
      ];
    },
    configurationsTable() {
      return this.configurations.map((c) => ({
        ...c,
        id: c.id,
        name: c.name,
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-",
      }));
    },
    configurationTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.name"), key: "name" },
        { name: this.$t("submission.publishAssessment.columns.created"), key: "createdAt" },
      ];
    },
    
    selectedWorkflowIds() {
      return this.selectedWorkflows.map(w => w.workflowId);
    },
    selectedStepNumbers() {
      return this.selectedWorkflows.map(w => w.stepNumber);
    },
    // Keep for backward compatibility
    selectedWorkflowId() {
      return this.selectedWorkflows.length > 0 ? this.selectedWorkflows[0].workflowId : null;
    },
    selectedStepNumber() {
      return this.selectedWorkflows.length > 0 ? this.selectedWorkflows[0].stepNumber : null;
    },
    selectedConfigurationId() {
      return this.selectedConfigurations.length > 0 ? this.selectedConfigurations[0].id : null;
    },
    selectedConfiguration() {
      if (!this.selectedConfigurationId) return null;
      return this.$store.getters["table/configuration/get"](this.selectedConfigurationId);
    },
    selectedConfigurationContent() {
      return this.selectedConfiguration?.content || null;
    },
    selectedConfigurationName() {
      return this.selectedConfiguration?.name || this.$t("common.unknown");
    },
    criteriaNames() {
      const cfg = this.selectedConfigurationContent;
      if (!cfg || !Array.isArray(cfg.rubrics)) return [];
      const names = [];
      cfg.rubrics.forEach((rubric) => {
        (rubric?.criteria || []).forEach((crit) => {
          if (crit?.name && !names.includes(crit.name)) {
            names.push(crit.name);
          }
        });
      });
      return names;
    },

    // Sessions filtered by workflow and configuration
    sessionsTable() {
      if (this.selectedWorkflows.length === 0 || !this.selectedConfigurationId) return [];

      // Collect all study steps from all selected workflows
      const allStudySteps = [];
      this.selectedWorkflows.forEach(selectedEntry => {
        if (selectedEntry && selectedEntry.studySteps) {
          allStudySteps.push(...selectedEntry.studySteps);
        }
      });

      if (allStudySteps.length === 0) return [];

      // Get all unique study IDs from selected workflows
      const matchingStudyIds = [...new Set(allStudySteps.map(s => s.studyId))];

      if (matchingStudyIds.length === 0) return [];

      return this.studySessions
        .filter((session) => {
          const study = this.studies.find((s) => s.id === session.studyId);
          // The study that the session belongs to needs to be closed and matches the workflow and configuration
          return this.isStudyClosed(study) && matchingStudyIds.includes(session.studyId)
        })
        .map((session) => {
          const study = this.studies.find((s) => s.id === session.studyId);
          const user = this.users.find((u) => u.id === session.userId);
          
          // Find related document and submission (prefer document with submissionId)
          const studyStepsForSession = this.studySteps.filter(
            (step) => step.studyId === session.studyId
          );
          const documentIds = studyStepsForSession.map((step) => step.documentId).filter(Boolean);
          let document = null;
          if (documentIds.length) {
            document =
              this.documents.find((d) => documentIds.includes(d.id) && d.submissionId) ||
              this.documents.find((d) => documentIds.includes(d.id)) ||
              null;
          }
          // Resolve parent document if needed
          if (document && !document.submissionId && document.parentDocumentId) {
            const parentDoc = this.documents.find((d) => d.id === document.parentDocumentId);
            if (parentDoc) {
              document = parentDoc;
            }
          }
          const submission =
            document?.submissionId &&
            this.submissions.find((s) => s.id === document.submissionId);

          // Get owner info from the study
          const owner = study
            ? this.users.find((u) => u.id === study.userId)
            : null;

          return {
            sessionId: session.id,
            studyId: session.studyId,
            studyName: study?.name || this.$t("common.unknown"),
            userId: session.userId,
            firstName: user?.firstName || this.$t("common.unknown"),
            lastName: user?.lastName || this.$t("common.unknown"),
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
    },
    sessionTableColumns() {
      return [
        { name: this.$t("submission.publishAssessment.columns.study"), key: "studyName" },
        { name: this.$t("submission.publishAssessment.columns.reviewerFirstName"), key: "firstName" },
        { name: this.$t("submission.publishAssessment.columns.reviewerLastName"), key: "lastName" },
        { name: this.$t("submission.publishAssessment.columns.ownerFirstName"), key: "ownerFirstName" },
        { name: this.$t("submission.publishAssessment.columns.ownerLastName"), key: "ownerLastName" },
        { name: this.$t("submission.publishAssessment.columns.submissionExtId"), key: "submissionExtId" },
      ];
    },
    formattedStudies() {
      // Group selected sessions by study
      const studyMap = {};
      this.selectedSessions.forEach((session) => {
        const studyId = session.studyId;
        if (!studyMap[studyId]) {
          studyMap[studyId] = {
            study: {
              id: studyId,
              name: session.studyName,
              ownerFirstName: session.ownerFirstName || "-",
              ownerLastName: session.ownerLastName || "-",
            },
            sessions: [],
          };
        }
        studyMap[studyId].sessions.push(session);
      });
      return Object.values(studyMap);
    },
    formattedSessions() {
      // Group selected sessions by reviewer (userId)
      const userMap = {};
      this.selectedSessions.forEach((session) => {
        const key = session.userId;
        if (!userMap[key]) {
          userMap[key] = [];
        }
        userMap[key].push(session);
      });
      return userMap;
    },
    publishMethodOptions() {
      return [
        { value: "csv", label: this.$t("submission.publishAssessment.publishMethods.downloadCsv"), disabled: false },
        { value: "moodle", label: this.$t("submission.publishAssessment.publishMethods.moodle"), disabled: false },
        { value: "email", label: this.$t("submission.publishAssessment.publishMethods.email"), disabled: true },
      ];
    },
    // Grade information computed properties
    gradeInformation() {
      const numberOfGrades = this.selectedSessions.length || 0;

      if (!this.selectedConfigurationContent || numberOfGrades === 0) {
        return {
          numberOfGrades,
          totalMaxPoints: 0,
          totalMinPoints: 0,
          maxGradeFromMoodle: this.selectedAssignmentMaxGrade || 0,
          conversionFactor: 0,
        };
      }

      // Use assessment definition from the first selected session (same config for all)
      const firstSession = this.selectedSessions[0];
      const { assessment } = this.getAssessmentDataForSession(firstSession);

      const totalMaxPoints = assessment.total_max_points ?? 0;
      const totalMinPoints = assessment.total_min_points ?? 0;
      const assignmentMaxGrade = this.selectedAssignmentMaxGrade || 0;
      const conversionFactor = this.getConversionFactorFromAssessment(assessment);

      return {
        numberOfGrades,
        totalMaxPoints,
        totalMinPoints,
        maxGradeFromMoodle: assignmentMaxGrade,
        conversionFactor,
      };
    },
  },
  watch: {
    selectedConfigurations() {
      // Reset downstream selections when configuration changes
      this.selectedWorkflows = [];
      this.selectedSessions = [];
    },
    selectedWorkflows() {
      // Reset sessions when workflow changes
      this.selectedSessions = [];
    },
  },
  methods: {
    /**
     * Calculates the linear conversion factor between assessment points and Moodle grade.
     * Uses the same logic for both the overview display and the actual grade publishing.
     */
    getConversionFactorFromAssessment(assessment) {
      const totalMaxPoints = assessment.total_max_points ?? 0;
      const totalMinPoints = assessment.total_min_points ?? 0;
      const assignmentMaxGrade = this.selectedAssignmentMaxGrade || 0;

      const sourcePointsRange = totalMaxPoints - totalMinPoints;
      const targetGradeRange = assignmentMaxGrade - 0;

      if (assignmentMaxGrade > 0 && sourcePointsRange > 0) {
        let factor = targetGradeRange / sourcePointsRange;
        // Keep 3 decimal places for display and internal use
        factor = Math.round(factor * 1000000) / 1000000;
        return factor;
      }

      return 0;
    },
    isStudyClosed(study) {
      if (!study) {
        return false;
      }
      return study.closed !== null ? true : false;
    },
    /**
     * Detect if a study step uses AI workflow by checking for services with skills.
     * Any service with a skill property indicates AI workflow.
     */
    getConfigurationIdFromConfig(cfg) {
      if (!cfg) return null;
      return (
        cfg?.settings?.configurationId ||
        cfg?.configurationId ||
        null
      );
    },
    getNlpServiceForStudyStep(studyStep) {
      if (!studyStep || !studyStep.configuration) return null;
      const cfg = studyStep.configuration;
      if (!cfg || !Array.isArray(cfg.services) || !cfg.services.length) return null;

      // Find any configured NLP skill or AI hook.
      const svc = cfg.services.find((s) => s.skill || s.hookId) || cfg.services[0];

      return svc || null;
    },
    /**
     * Get assessment data key for a study step.
     * Returns canonical AI/NLP keys, otherwise "assessment_result".
     */
    getAssessmentDataKeys(studyStep) {
      const svc = this.getNlpServiceForStudyStep(studyStep);
      const keys = getAssessmentResultKeyCandidates(svc, svc?.hookName);
      return keys.length ? keys : [ASSESSMENT_RESULT_KEY];
    },
    /**
     * @deprecated Since the user can select a specific step directly, 
     * this method is no longer in use and can be removed 
     * after the testing of the assessment publishing feature.
     * 
     * Find the study step for a study that matches the selected configuration.
     * Prefers the earliest occurrence in the workflow order.
     */
    getMatchingStudyStepForStudy(studyId) {
      if (!this.selectedConfigurationId) return null;

      const stepsForStudy = this.studySteps.filter(
        (step) =>
          step &&
          !step.deleted &&
          step.studyId === studyId &&
          this.getConfigurationIdFromConfig(step.configuration) === this.selectedConfigurationId
      );
      if (stepsForStudy.length === 0) return null;

      const study = this.studies.find((s) => s.id === studyId);
      const workflowId = study?.workflowId;
      const orderedWorkflowSteps = workflowId
        ? this.orderedWorkflowStepsByWorkflow[workflowId] || []
        : [];

      const orderedMatch =
        orderedWorkflowSteps
          .map((ws) => stepsForStudy.find((step) => step.workflowStepId === ws.id))
          .find((step) => !!step) || null;

      return orderedMatch || stepsForStudy[0];
    },
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter(
        (urm) => urm.userId === userId && !urm.deleted
      );
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? role.name : this.$t("common.unknown");
        })
        .join(", ");
    },
    open() {
      this.reset();
      this.$refs.assessmentStepper.open();
    },
    reset() {
      this.selectedWorkflows = [];
      this.selectedConfigurations = [];
      this.selectedSessions = [];
      this.publishMethod = "csv";
      this.linkCollection = "studies";
      this.selectedAssignmentMaxGrade = 0;
      this.moodleOptions = {};
      this.isReviewUrlIncluded = false;
    },
    selectAssignment({ maxGrade }) {
      this.selectedAssignmentMaxGrade = maxGrade ?? 0;
    },
    handleSubmit() {
      if (this.publishMethod === "csv") {
        this.downloadCSV();
        return;
      }
      if (this.publishMethod === "moodle") {
        this.uploadGrades();
        return;
      }
    },
    /**
     * Validates that configuration content is available.
     */
    validateConfiguration() {
      const configContent = this.selectedConfigurationContent;
      if (!configContent) {
        this.eventBus.emit("toast", {
          title: this.$t("submission.publishAssessment.toasts.configurationMissing.title"),
          message: this.$t("submission.publishAssessment.toasts.configurationMissing.message"),
          variant: "danger",
        });
        return false;
      }
      return true;
    },
    /**
     * Retrieves assessment data for a given session.
     * Returns an object with scores and assessment calculation.
     */
    getAssessmentDataForSession(session) {
      // Search across all selected workflows to find the matching study step
      let matchingStudyStep = null;
      for (const selectedEntry of this.selectedWorkflows) {
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
      const documentDataArray = this.$store.getters["table/document_data/getByKey"]("studySessionId", session.sessionId);
      const documentDataItem = documentDataArray.find(
        (dd) => dd?.studyStepId === matchingStudyStep.id && dd?.key === ASSESSMENT_RESULT_KEY
      );
      const assessmentRaw = documentDataItem?.value || {};

      const scoreState = assessmentRaw || {};
      const scores = buildScoresFromState(scoreState);
      const configContent = this.selectedConfigurationContent;
      const assessment = calculateAssessmentScore(configContent, scores);

      return { scores, assessment };
    },
    /**
     * Gets the owner user for a given session.
     * Returns the user object or null if not found.
     */
    getOwnerUserForSession(session) {
      const study = session.studyId ? this.studies.find((s) => s.id === session.studyId) : null;
      return study ? this.users.find((u) => u.id === study.userId) : null;
    },
    /**
     * Gets the reviewer user for a given session.
     * Returns the user object or null if not found.
     */
    getReviewerUserForSession(session) {
      return this.users.find((u) => u.id === session.userId) || null;
    },
    /**
     * Uploads the selected sessions' grades to a specific assignment in Moodle.
     */
    uploadGrades() {
      if (!this.validateConfiguration()) return;

      const grades = this.selectedSessions.map((session) => {
        const { assessment } = this.getAssessmentDataForSession(session);
        const ownerUser = this.getOwnerUserForSession(session);

        const gradeEntry = {
          extId: ownerUser?.extId || session.ownerExtId || "",
          grade: this.convertAssessmentScore(assessment),
        };

        // Optionally include review URL as feedback text
        if (this.isReviewUrlIncluded && session.link) {
          gradeEntry.text = session.link;
        }

        return gradeEntry;
      });

      this.$refs.assessmentStepper.setWaiting(true);
      this.$socket.emit("submissionPublishGrades", {
          options: this.moodleOptions,
          grades: grades,
        }, (res) => {
          this.$refs.assessmentStepper.setWaiting(false);
          if (res.success) {
            this.$refs.assessmentStepper.close();
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.gradesPublished.title"),
              message: this.$t("submission.publishAssessment.toasts.gradesPublished.message"),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.failedToPublishGrades.title"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        }
      );
    },
    /**
     * Converts an assessment score from one scale to another.
     * Uses the same conversionFactor that is shown in the overview:
     *   convertedGrade = normalizedPoints * conversionFactor
     * and then rounds the result to 2 decimal places.
     */
    convertAssessmentScore(assessment) {
      const { total_min_points, achieved_points } = assessment;

      const conversionFactor = this.getConversionFactorFromAssessment(assessment);
      const normalizedPoints = achieved_points - (total_min_points ?? 0);
      const convertedGrade = normalizedPoints * conversionFactor;
      // Round final grade to 2 decimal places
      return Math.round(convertedGrade * 100) / 100;
    },
    /**
     * Build CSV rows for selected sessions using assessmentScore utilities.
     * Each session becomes one row; criteria columns are derived from configuration.
     */
    downloadCSV() {
      if (!this.validateConfiguration()) return;

      const criteriaList = this.criteriaNames;
      const rows = this.selectedSessions.map((session) => {
        const { scores, assessment } = this.getAssessmentDataForSession(session);
        const reviewer = this.getReviewerUserForSession(session);
        const ownerUser = this.getOwnerUserForSession(session);
        const submission = session.submissionId ? this.submissions.find((s) => s.id === session.submissionId) : null;

        const row = {
          [this.$t("submission.publishAssessment.csv.userExtId")]: ownerUser?.extId || session.ownerExtId || "",
          [this.$t("submission.publishAssessment.csv.userFirstName")]: ownerUser?.firstName || session.ownerFirstName || "",
          [this.$t("submission.publishAssessment.csv.userLastName")]: ownerUser?.lastName || session.ownerLastName || "",
          [this.$t("submission.publishAssessment.csv.userName")]: ownerUser?.userName || session.ownerUserName || "",
          [this.$t("submission.publishAssessment.csv.submissionId")]: session.submissionId || "",
          [this.$t("submission.publishAssessment.csv.submissionExtId")]: submission?.extId || "",
          [this.$t("submission.publishAssessment.csv.reviewerFirstName")]: reviewer?.firstName || "",
          [this.$t("submission.publishAssessment.csv.reviewerLastName")]: reviewer?.lastName || "",
          [this.$t("submission.publishAssessment.csv.reviewerUserName")]: reviewer?.userName || "",
          [this.$t("submission.publishAssessment.csv.reviewerRoles")]: reviewer ? this.getUserRoles(reviewer.id) : "",
          [this.$t("submission.publishAssessment.csv.hash")]: session.hash || "",
          [this.$t("submission.publishAssessment.csv.totalPoints")]: assessment.achieved_points ?? 0,
        };

        // Add dynamic criteria columns
        criteriaList.forEach((criterionName) => {
          row[criterionName] = scores[criterionName] ?? 0;
        });

        return row;
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const configName = this.selectedConfigurationName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileBaseName = `assessment_${configName}_${timestamp}`;
      downloadObjectsAs(rows, fileBaseName, "csv");

      this.eventBus.emit("toast", {
        title: this.$t("submission.publishAssessment.toasts.csvExport.title"),
        message: this.$t("submission.publishAssessment.toasts.csvExport.message"),
        variant: "success",
      });
    },
  },
};
</script>

<style scoped>
.list-group-item {
  padding: 0.5rem 1rem;
}
</style>

