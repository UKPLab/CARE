<template>
  <StepperModal
    ref="assessmentStepper"
    size="xl"
    :steps="steps"
    :validation="stepValid"
    @submit="handleSubmit"
    @step-change="onStepChange"
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
        <Loader v-if="workflowsLoading" :loading="true"/>
        <BasicTable
          v-else
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
        <BackendTable
          ref="sessionTable"
          table="study_session"
          :columns="sessionTableColumns"
          :query-scope="sessionQueryScope"
          :query-filter-schema="sessionFilterSchema"
          :query-search-columns="sessionSearchColumns"
          :options="sessionTableOptions"
          :max-table-height="'50vh'"
          @selection-change="onSessionSelectionChange"
        />
      </div>
    </template>

    <!-- STEP 4: Confirmation -->
    <template #step-4>
      <PublishAssessmentConfirmationStep
        v-model:link-collection="linkCollection"
        :selected-sessions="sessionSelection.rows"
        :all-matching="sessionSelection.allMatching"
        :selected-count="selectedSessionCount"
      />
    </template>

    <!-- STEP 5: Publishing Options -->
    <template #step-5>
      <PublishAssessmentPublishingStep
        v-model:publish-method="publishMethod"
        v-model:is-review-url-included="isReviewUrlIncluded"
        v-model:moodle-options="moodleOptions"
        :selected-session-count="selectedSessionCount"
        :selected-configuration-content="selectedConfigurationContent"
        :grade-information="gradeInformation"
        @select-assignment="selectAssignment"
      />
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BackendTable from "@/basic/BackendTable.vue";
import Loader from "@/basic/Loading.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import PublishAssessmentConfirmationStep from "./PublishAssessmentConfirmationStep.vue";
import PublishAssessmentPublishingStep from "./PublishAssessmentPublishingStep.vue";
import { calculateAssessmentScore } from "assessment-score";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import { NUMERIC_OPERATORS } from "@/basic/table/searchTokens.js";
import {
  applySavedSelection,
  cloneSelection,
  emptySelection,
  selectionRestoreInfo,
} from "@/basic/table/emptySelection.js";
import {
  getAssessmentDataForSession,
  convertAssessmentScore,
  getConversionFactorFromAssessment,
} from "./helpers/publishAssessmentScoring.js";
import { buildWorkflowsTable, sessionReviewLink } from "./helpers/publishAssessmentTables.js";
import { buildCsvRows } from "./helpers/publishAssessmentCsvRows.js";

/**
 * Modal for publishing assessment data with CSV export
 *
 * Workflow steps and their session counts (publishAssessmentWorkflows), the session list
 * (BackendTable on study_session with an assessment query scope) and the exported scores
 * (publishAssessmentData) are all resolved server-side.
 *
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentModal",
  components: { BasicTable, BackendTable, Loader, StepperModal, PublishAssessmentConfirmationStep, PublishAssessmentPublishingStep },
  subscribeTable: [
    { table: "workflow" },
    { table: "workflow_step" },
    { table: "configuration", filter: [{ key: "type", value: 0 }] },
    { table: "user_role" },
    { table: "user_role_matching" },
  ],
  data() {
    return {
      selectedWorkflows: [],
      selectedConfigurations: [],
      // Workflow × step rows with their session counts (publishAssessmentWorkflows).
      workflowRows: [],
      workflowsLoading: false,
      sessionSelection: emptySelection(),
      moodleOptions: {},
      publishMethod: "csv",
      linkCollection: "studies",
      selectedAssignmentMaxGrade: 0, // Store max grade for selected assignment
      isReviewUrlIncluded: false, // Option to include review URL in Moodle feedback
      sessionStepLive: false,
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
        this.selectedSessionCount > 0,
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
    sessionTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "id", order: "ASC"},
      };
    },
    // Data sources
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    workflows() {
      return this.$store.getters["table/workflow/getAll"] || [];
    },
    configurations() {
      return this.$store.getters["table/configuration/getFiltered"](
        (c) => c.type === 0 && !c.deleted
      ) || [];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"] || [];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"] || [];
    },

    // Table data
    workflowsTable() {
      return buildWorkflowsTable({
        workflowRows: this.workflowRows,
        workflows: this.workflows,
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
    // Grade overview shown in the publishing step for Moodle
    gradeInformation() {
      const numberOfGrades = this.selectedSessionCount;
      // The point range only depends on the rubric (same config for all sessions), not on scores.
      const assessment = this.selectedConfigurationContent
        ? calculateAssessmentScore(this.selectedConfigurationContent, {})
        : {};
      const assignmentMaxGrade = this.selectedAssignmentMaxGrade || 0;

      return {
        numberOfGrades,
        totalMaxPoints: assessment.total_max_points ?? 0,
        totalMinPoints: assessment.total_min_points ?? 0,
        maxGradeFromMoodle: assignmentMaxGrade,
        conversionFactor: getConversionFactorFromAssessment(assessment, assignmentMaxGrade),
      };
    },

    /**
     * Which sessions the session table lists: the picked configuration in the picked workflow steps,
     * closed studies only. The server turns this into the WHERE (study_session model), so neither
     * study nor study_step ids travel to the browser.
     */
    sessionQueryScope() {
      if (!this.selectedConfigurationId || this.selectedWorkflows.length === 0) {
        return null;
      }
      return {
        assessment: {
          configurationId: this.selectedConfigurationId,
          projectId: this.projectId,
          steps: this.selectedWorkflows.map((row) => ({
            workflowId: row.workflowId,
            stepNumber: row.stepNumber,
          })),
        },
      };
    },
    sessionTableColumns() {
      const columns = [
        { name: this.$t("submission.publishAssessment.columns.study"), key: "studyName" },
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          { name: this.$t("submission.publishAssessment.columns.reviewerFirstName"), key: "firstName" },
          { name: this.$t("submission.publishAssessment.columns.reviewerLastName"), key: "lastName" },
          { name: this.$t("submission.publishAssessment.columns.ownerFirstName"), key: "ownerFirstName" },
          { name: this.$t("submission.publishAssessment.columns.ownerLastName"), key: "ownerLastName" },
        );
      }
      columns.push(
        { name: this.$t("submission.publishAssessment.columns.submissionExtId"), key: "submissionExtId" },
      );
      return columns;
    },
    sessionFilterSchema() {
      const schema = {
        submissionExtId: {
          label: this.$t("submission.publishAssessment.columns.submissionExtId"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        },
      };
      if (this.canReadPrivateInformation) {
        schema.firstName = {label: this.$t("submission.publishAssessment.columns.reviewerFirstName"), type: "text"};
        schema.lastName = {label: this.$t("submission.publishAssessment.columns.reviewerLastName"), type: "text"};
        schema.ownerFirstName = {label: this.$t("submission.publishAssessment.columns.ownerFirstName"), type: "text"};
        schema.ownerLastName = {label: this.$t("submission.publishAssessment.columns.ownerLastName"), type: "text"};
      }
      return schema;
    },
    sessionSearchColumns() {
      const columns = ["studyName"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName", "ownerFirstName", "ownerLastName");
      }
      return columns;
    },
    selectedSessionCount() {
      return this.sessionSelection.count;
    },
  },
  watch: {
    selectedConfigurations() {
      // Reset downstream selections when configuration changes
      this.selectedWorkflows = [];
      this.sessionSelection = emptySelection();
      this.loadWorkflows();
    },
    selectedWorkflows(next, prev) {
      const ids = (rows) => (rows || []).map((row) => row.id).join(",");
      if (ids(next) === ids(prev)) return;
      // Reset sessions when the picked workflow steps change (the query behind them changed)
      this.sessionSelection = emptySelection();
    },
  },
  methods: {
    /**
     * Workflow steps that run the picked configuration, with their session counts.
     */
    loadWorkflows() {
      this.workflowRows = [];
      if (!this.selectedConfigurationId) {
        this.workflowsLoading = false;
        return;
      }

      const requestedConfigurationId = this.selectedConfigurationId;
      this.workflowsLoading = true;
      this.$socket.emit("publishAssessmentWorkflows", {
        configurationId: requestedConfigurationId,
        projectId: this.projectId,
      }, (res) => {
        // Stale reply: the selection changed (or was cleared) while waiting.
        // A newer request owns the loading state, so leave it untouched.
        if (requestedConfigurationId !== this.selectedConfigurationId) {
          return;
        }
        this.workflowsLoading = false;
        if (!res?.success) {
          this.eventBus.emit("toast", {
            title: this.$t("submission.publishAssessment.toasts.workflowsFailed.title"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        this.workflowRows = res.data?.workflows || [];
      });
    },
    onStepChange(step) {
      if (this.sessionStepLive) {
        const live = this.$refs.sessionTable?.getSelection?.();
        if (live) this.sessionSelection = {...live};
      }
      this.sessionStepLive = false;
      if (step !== 2) return;
      this.$nextTick(() => {
        this.restoreSessionSelection();
        this.sessionStepLive = true;
      });
    },
    restoreSessionSelection() {
      const saved = this.sessionSelection;
      const restore = selectionRestoreInfo(saved);
      if (!restore) return;
      applySavedSelection(this.$refs.sessionTable, saved, restore);
    },
    onSessionSelectionChange() {
      if (!this.sessionStepLive) return;
      // Snapshot while the table exists: the stepper unmounts it before the confirmation step.
      this.sessionSelection = cloneSelection(this.$refs.sessionTable?.getSelection());
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
      this.workflowRows = [];
      this.workflowsLoading = false;
      this.sessionSelection = emptySelection();
      this.sessionStepLive = false;
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
      if (!this.validateConfiguration()) return;
      if (this.selectedSessionCount <= 0) {
        this.eventBus.emit("toast", {
          title: this.$t("submission.publishAssessment.toasts.noSessionsSelected.title"),
          message: this.$t("submission.publishAssessment.toasts.noSessionsSelected.message"),
          variant: "warning",
        });
        return;
      }
      this.fetchAssessmentData((sessions) => {
        if (this.publishMethod === "moodle") {
          this.uploadGrades(sessions);
          return;
        }
        this.$refs.assessmentStepper.setWaiting(false);
        this.downloadCSV(sessions);
      });
    },
    /**
     * Scores and identity for the selected sessions. Either the ticked ids or the session query
     * itself (select-all) — the server resolves the rows again from the same filter and scope.
     * @param {function(Array<Object>): void} onLoaded
     */
    fetchAssessmentData(onLoaded) {
      this.$refs.assessmentStepper.setWaiting(true);
      this.$socket.emit("publishAssessmentData", {
        selection: {
          allMatching: this.sessionSelection.allMatching,
          excludeIds: this.sessionSelection.excludeIds,
          ids: this.sessionSelection.ids,
          filter: this.sessionSelection.filter,
          query: this.sessionSelection.query,
          scope: this.sessionSelection.scope || this.sessionQueryScope,
        },
      }, (res) => {
        if (!res?.success) {
          this.$refs.assessmentStepper.setWaiting(false);
          this.eventBus.emit("toast", {
            title: this.$t("submission.publishAssessment.toasts.assessmentDataFailed.title"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        onLoaded(res.data?.sessions || []);
      });
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
     * Scores and total for one exported session. The server picks the scores (saved row,
     * hook/NLP rows, document-level fallback); the client only applies the rubric.
     * @param {Object} session row from publishAssessmentData
     * @returns {{scores: Object, assessment: Object}}
     */
    getAssessmentDataForSession(session) {
      return getAssessmentDataForSession(session, this.selectedConfigurationContent);
    },
    /**
     * Uploads the selected sessions' grades to a specific assignment in Moodle.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    uploadGrades(sessions) {
      const grades = sessions.map((session) => {
        const { assessment } = this.getAssessmentDataForSession(session);

        const gradeEntry = {
          extId: session.ownerExtId || "",
          grade: convertAssessmentScore(assessment, this.selectedAssignmentMaxGrade),
        };

        // Optionally include review URL as feedback text
        if (this.isReviewUrlIncluded && session.hash) {
          gradeEntry.text = sessionReviewLink(session.hash);
        }

        return gradeEntry;
      });

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
     * Build CSV rows for the exported sessions and download them.
     * Each session becomes one row; criteria columns are derived from configuration.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    downloadCSV(sessions) {
      const rows = buildCsvRows({
        sessions,
        criteriaList: this.criteriaNames,
        getAssessmentDataForSession: (session) => this.getAssessmentDataForSession(session),
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
