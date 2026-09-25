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
      <PublishAssessmentConfirmationStep
        v-model:link-collection="linkCollection"
        :selected-sessions="selectedSessions"
      />
    </template>

    <!-- STEP 5: Publishing Options -->
    <template #step-5>
      <PublishAssessmentPublishingStep
        v-model:publish-method="publishMethod"
        v-model:is-review-url-included="isReviewUrlIncluded"
        v-model:moodle-options="moodleOptions"
        :selected-sessions="selectedSessions"
        :selected-workflows="selectedWorkflows"
        :selected-configuration-content="selectedConfigurationContent"
        :selected-assignment-max-grade="selectedAssignmentMaxGrade"
        @select-assignment="selectAssignment"
      />
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import PublishAssessmentConfirmationStep from "./PublishAssessmentConfirmationStep.vue";
import PublishAssessmentPublishingStep from "./PublishAssessmentPublishingStep.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import {
  isStudyClosed,
  getConfigurationIdFromConfig,
  getAssessmentDataForSession,
  convertAssessmentScore,
} from "./publishAssessmentScoring.js";
import { buildOrderedWorkflowStepsByWorkflow, buildWorkflowsTable, buildSessionsTable } from "./publishAssessmentTables.js";
import { buildCsvRows } from "./publishAssessmentCsvRows.js";

/**
 * Modal for publishing assessment data with CSV export
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentModal",
  components: { BasicTable, StepperModal, PublishAssessmentConfirmationStep, PublishAssessmentPublishingStep },
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
      return buildOrderedWorkflowStepsByWorkflow(this.workflowSteps);
    },

    // Table data
    workflowsTable() {
      return buildWorkflowsTable({
        selectedConfigurationId: this.selectedConfigurationId,
        studies: this.studies,
        workflows: this.workflows,
        studySteps: this.studySteps,
        orderedWorkflowStepsByWorkflow: this.orderedWorkflowStepsByWorkflow,
        studySessions: this.studySessions,
        getConfigurationIdFromConfig,
        isStudyClosed,
        t: this.$t,
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
      return buildSessionsTable({
        selectedWorkflows: this.selectedWorkflows,
        selectedConfigurationId: this.selectedConfigurationId,
        studySessions: this.studySessions,
        studies: this.studies,
        studySteps: this.studySteps,
        documents: this.documents,
        submissions: this.submissions,
        users: this.users,
        isStudyClosed,
        t: this.$t,
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
          getConfigurationIdFromConfig(step.configuration) === this.selectedConfigurationId
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
      return getAssessmentDataForSession(
        session,
        this.selectedWorkflows,
        (studySessionId) => this.$store.getters["table/document_data/getByKey"]("studySessionId", studySessionId),
        this.selectedConfigurationContent
      );
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
          grade: convertAssessmentScore(assessment, this.selectedAssignmentMaxGrade),
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
     * Build CSV rows for selected sessions using assessmentScore utilities.
     * Each session becomes one row; criteria columns are derived from configuration.
     */
    downloadCSV() {
      if (!this.validateConfiguration()) return;

      const rows = buildCsvRows({
        selectedSessions: this.selectedSessions,
        criteriaList: this.criteriaNames,
        submissions: this.submissions,
        getAssessmentDataForSession: (session) => this.getAssessmentDataForSession(session),
        getReviewerUserForSession: (session) => this.getReviewerUserForSession(session),
        getOwnerUserForSession: (session) => this.getOwnerUserForSession(session),
        getUserRoles: (userId) => this.getUserRoles(userId),
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

