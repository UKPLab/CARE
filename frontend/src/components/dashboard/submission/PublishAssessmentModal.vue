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
      <PublishAssessmentConfigurationStep v-model="selectedConfigurations" />
    </template>

    <!-- STEP 2: Workflow Selection -->
    <template #step-2>
      <PublishAssessmentWorkflowStep
        v-model="selectedWorkflows"
        :loading="workflowsLoading"
        :workflow-rows="workflowRows"
      />
    </template>

    <!-- STEP 3: Session Selection -->
    <template #step-3>
      <PublishAssessmentSessionStep
        v-model="sessionSelection"
        :configuration-id="selectedConfigurationId"
        :project-id="projectId"
        :workflow-steps="selectedWorkflows"
      />
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
        ref="publishingStep"
        v-model:publish-method="publishMethod"
        v-model:is-review-url-included="isReviewUrlIncluded"
        v-model:moodle-options="moodleOptions"
        :selected-session-count="selectedSessionCount"
        :selected-configuration-content="selectedConfigurationContent"
        :selected-configuration-name="selectedConfiguration?.name || $t('common.unknown')"
        :grade-information="gradeInformation"
        @select-assignment="selectAssignment"
      />
    </template>
  </StepperModal>
</template>

<script>
import PublishAssessmentConfigurationStep from "./PublishAssessmentConfigurationStep.vue";
import PublishAssessmentWorkflowStep from "./PublishAssessmentWorkflowStep.vue";
import PublishAssessmentSessionStep from "./PublishAssessmentSessionStep.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import PublishAssessmentConfirmationStep from "./PublishAssessmentConfirmationStep.vue";
import PublishAssessmentPublishingStep from "./PublishAssessmentPublishingStep.vue";
import { calculateAssessmentScore } from "assessment-score";
import { resolveApiMessage } from "@/assets/utils.js";
import { emptySelection } from "@/basic/table/emptySelection.js";
import { getConversionFactorFromAssessment } from "./helpers/publishAssessmentScoring.js";

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
  components: { PublishAssessmentConfigurationStep, PublishAssessmentWorkflowStep, PublishAssessmentSessionStep, StepperModal, PublishAssessmentConfirmationStep, PublishAssessmentPublishingStep },
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
    // Data sources
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
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
      this.fetchAssessmentData(async (sessions) => {
        let shouldClose;
        try {
          shouldClose = await this.$refs.publishingStep.publish(sessions);
        } finally {
          this.$refs.assessmentStepper.setWaiting(false);
        }
        if (shouldClose) this.$refs.assessmentStepper.close();
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
          scope: this.sessionSelection.scope,
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
  },
};
</script>

<style scoped>
.list-group-item {
  padding: 0.5rem 1rem;
}
</style>
