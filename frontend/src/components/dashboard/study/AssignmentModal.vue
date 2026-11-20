<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="steps.map(step => step.valid)"
      size="xl"
      @submit="onSubmit"
      @step-change="onStepChange">
    <template #title>
      <h5 class="modal-title">
        {{ bulk ? $t('dashboard.study.createBulkAssignment') : $t('dashboard.study.createSingleAssignmentTitle') }}
      </h5>
    </template>

    <template v-if="templates.length === 0" #error>
      <p class="text-center text-danger">{{ $t('dashboard.study.noStudyTemplatesAvailable') }}</p>
      <p class="text-center">{{ $t('dashboard.study.createTemplateToProceed') }}</p>
    </template>

    <!-- One panel per step; which panel a step shows depends on assignment type and bulk (stepContent). -->
    <template #step="{ index }">
      <TemplateSelectionStep
          v-if="stepContent[index] === 'template'"
          :key="`template-step-${stepResetKey}`"
          :modal-value="templateStepModalValue"
          @update:modal-value="templateStepModalValue = $event"
          @update:assignment-type="assignmentType = $event"
          @update:workflow-steps="workflowSteps = $event"
          @update:template="template = $event"
          @update:workflow="workflow = $event"
          @update:is-valid="templateValid = $event"
      />
      <WorkflowMappingStep
          v-else-if="stepContent[index] === 'workflow-mapping'"
          :key="`workflow-mapping-step-${stepResetKey}`"
          :modal-value="workflowMappingStepModalValue"
          @update:modal-value="workflowMappingStepModalValue = $event"
          @update:is-valid="workflowMappingValid = $event"
      />
      <!-- Documents / submissions (assignment-selection) or study sessions (session-selection) -->
      <AssignmentSelectionStep
          v-else-if="stepContent[index] === 'assignment-selection' || stepContent[index] === 'session-selection'"
          :key="`assignment-step-${stepResetKey}`"
          ref="assignmentSelectionStep"
          :modal-value="assignmentModalValue"
          :initial-selection="assignmentSelection"
          @update:modal-value="assignmentModalValue = $event"
          @update:selected-assignment-user-ids="onAssignmentUserIds(index, $event)"
          @update:selection="onAssignmentSelection"
          @update:is-valid="assignmentSelectionValid = $event"
      />
      <ReviewerSelectionStep
          v-else-if="stepContent[index] === 'reviewer-selection'"
          :key="`reviewer-step-${stepResetKey}`"
          ref="reviewerSelectionStep"
          :selected-assignment-user-ids="selectedAssignmentUserIds"
          :assignment-selection="assignmentSelection"
          :initial-selection="reviewerQuerySelection"
          @update:selection="onReviewerSelection"
          @update:is-valid="reviewerSelectionValid = $event"
      />
      <DistributionStep
          v-else-if="stepContent[index] === 'distribution'"
          :key="`distribution-step-${stepResetKey}`"
          :modal-value="distributionModalValue"
          @update:modal-value="distributionModalValue = $event"
          @update:is-valid="distributionValid = $event"
      />
      <ConfirmationStep
          v-else
          ref="confirmationStep"
          :variant="`${assignmentType === 'study_session' ? 'session' : 'doc-sub'}-${bulk ? 'bulk' : 'single'}`"
          :enable-email-notification="templateStepModalValue?.enableEmailNotification ?? false"
          :workflow-mapping="workflowMappingStepModalValue?.workflowMapping"
          @settled="onSettled"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import { resolveApiMessage } from "@/assets/utils";
import { computed } from "vue";
import TemplateSelectionStep from "./assignment/TemplateSelectionStep.vue";
import WorkflowMappingStep from "./assignment/WorkflowMappingStep.vue";
import AssignmentSelectionStep from "./assignment/AssignmentSelectionStep.vue";
import ReviewerSelectionStep from "./assignment/ReviewerSelectionStep.vue";
import DistributionStep from "./assignment/DistributionStep.vue";
import ConfirmationStep from "./assignment/ConfirmationStep.vue";
import {cloneSelection, emptySelection} from "@/basic/table/emptySelection.js";

/**
 * Modal for bulk creating assignments
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf, Andrii Nikitin
 */
export default {
  name: "ImportModal",
  components: {
    StepperModal,
    TemplateSelectionStep,
    WorkflowMappingStep,
    AssignmentSelectionStep,
    ReviewerSelectionStep,
    DistributionStep,
    ConfirmationStep,
  },
  subscribeTable: [
    {
      table: "document",
      filter: [{ key: "readyForReview", value: true }],
      inject: [{
        type: "parent",
        table: "user",
        by: "userId",
        fields: ["firstName", "lastName", "userName"],
      }],
    },
    { table: "assignment" },
    { table: "study", filter: [{ key: "template", value: true }] },
    { table: "template" },
  ],
  provide() {
    return {
      bulk: computed(() => this.bulk),
      template: computed(() => this.template),
      workflow: computed(() => this.workflow),
      assignmentType: computed(() => this.assignmentType),
      targetWorkflowId: computed(() => this.workflowMappingStepModalValue?.targetWorkflowId ?? null),
      newStudyOwner: computed(() => this.workflowMappingStepModalValue?.newStudyOwner ?? 'session_owner'),
      selectedAssignments: computed(() => this.assignmentModalValue),
      selectedReviewer: computed(() => this.selectedReviewer),
      workflowSteps: computed(() => this.workflowSteps),
      reviewerSelectionMode: computed(() => this.distributionModalValue.reviewerSelectionMode ?? {}),
      roleSelection: computed(() => this.distributionModalValue.roleSelection ?? {}),
      reviewerSelection: computed(() => this.distributionModalValue.reviewerSelection ?? {}),
      numberOfReviews: computed(() => this.distributionModalValue.numberOfReviews ?? 0),
      roles: computed(() => this.roles),
      assignmentCount: computed(() => this.assignmentCount),
      reviewerCount: computed(() => this.reviewerCount),
    };
  },
  data() {
    return {

      // Whether the modal is creating a bulk or single assignment, set via open(bulk)
      bulk: true,

      // Incremented on each reset to force step components to remount cleanly
      stepResetKey: 0,

      // ── Values emitted up from step components ──────────────────────────────

      // Step 1: TemplateSelectionStep
      assignmentType: 'document',
      workflowSteps: [],
      template: null,
      workflow: null,
      templateStepModalValue: {},

      // Step 2: WorkflowMappingStep
      workflowMappingStepModalValue: {},

      // Step 2/3: AssignmentSelectionStep
      assignmentModalValue: [],
      selectedAssignmentUserIds: [],
      assignmentSelection: emptySelection(),
      reviewerQuerySelection: emptySelection(),

      // Step 3/4: ReviewerSelectionStep
      selectedReviewer: [],

      // Step 4/5: DistributionStep (mode, role/reviewer quotas, numberOfReviews)
      distributionModalValue: {},

      // Step validity (emitted from children)
      templateValid: false,
      workflowMappingValid: false,
      assignmentSelectionValid: false,
      reviewerSelectionValid: false,
      distributionValid: false,

      resolveLoading: false,
      activeStep: 0,
    };
  },
  computed: {
    // Store lookups shared with the step components
    templates() {
      return this.$store.getters["table/study/getFiltered"](item => item.template === true);
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    // Query-table selections (submissions, sessions) may count select-all rows not loaded here.
    assignmentCount() {
      return (this.assignmentType !== "document" && this.assignmentSelection.count) || this.assignmentModalValue.length;
    },
    reviewerCount() {
      return this.reviewerQuerySelection.count || this.selectedReviewer.length;
    },
    /** Wizard steps in order; which panels exist depends on assignment type and bulk. */
    steps() {
      const isSession = this.assignmentType === "study_session";
      const selectionTitle = isSession ? "studySessionSelection"
        : this.assignmentType === "submission" ? "submissionSelection" : "documentSelection";
      return [
        { panel: "template", title: this.$t("dashboard.study.templateSelection"), valid: this.templateValid },
        ...(isSession ? [{
          panel: "workflow-mapping", title: this.$t("dashboard.study.workflowMapping"), valid: this.workflowMappingValid,
        }] : []),
        {
          panel: isSession ? "session-selection" : "assignment-selection",
          title: this.$t(`dashboard.study.${selectionTitle}`),
          valid: this.assignmentSelectionValid,
        },
        { panel: "reviewer-selection", title: this.$t("dashboard.study.reviewerSelection"), valid: this.reviewerSelectionValid },
        ...(this.bulk ? [{
          panel: "distribution", title: this.$t("dashboard.study.distribution"), valid: this.distributionValid,
        }] : []),
        { panel: "confirmation", title: this.$t("common.confirmation"), valid: true },
      ];
    },
    stepContent() {
      return this.steps.map(step => step.panel);
    },
  },
  watch: {
    assignmentType(next, prev) {
      if (!prev || next === prev) return;
      this.resetDownstreamSelection();
    },
  },
  methods: {
    open(bulk = true) {
      this.bulk = bulk;
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      // Stepper goes back to step 0 on open; the old step is still mounted when that
      // step-change fires, so it must not be captured into the fresh wizard (activeStep 0).
      this.setResolving(false);
      Object.assign(this.$data, this.$options.data.call(this), {
        bulk: this.bulk,
        stepResetKey: this.stepResetKey + 1,
      });
    },
    /**
     * Clears everything picked after the assignment type: assignments, reviewers, distribution.
     * Shared by reset() and the assignmentType watcher, since a new type invalidates all of it.
     */
    resetDownstreamSelection() {
      const fresh = this.$options.data.call(this);
      for (const key of ["assignmentModalValue", "selectedAssignmentUserIds", "assignmentSelection",
        "reviewerQuerySelection", "selectedReviewer", "distributionModalValue",
        "assignmentSelectionValid", "reviewerSelectionValid", "distributionValid"]) {
        this[key] = fresh[key];
      }
    },
    onAssignmentSelection(selection) {
      const panel = this.stepContent[this.activeStep];
      if (panel === "assignment-selection" && this.assignmentType !== "submission") return;
      if (panel !== "session-selection" && panel !== "assignment-selection") return;
      this.assignmentSelection = cloneSelection(selection);
    },
    // Only the document/submission selection step reports owners; the reviewer step excludes them.
    onAssignmentUserIds(stepIndex, userIds) {
      if (this.stepContent[stepIndex] === "assignment-selection") this.selectedAssignmentUserIds = userIds;
    },
    onReviewerSelection(selection) {
      if (this.stepContent[this.activeStep] !== "reviewer-selection") return;
      this.reviewerQuerySelection = cloneSelection(selection);
    },
    /**
     * Before Distribution / Confirm: turn queryTable selection (including select-all)
     * into row arrays. Distribution still builds sliders from selectedReviewer objects.
     */
    onStepChange(stepIndex) {
      if (stepIndex === this.activeStep) return;
      const forward = stepIndex > this.activeStep;
      Object.assign(this.$data, this.liveSelections()); // keep the leaving step's selection
      this.activeStep = stepIndex;
      if (!forward) this.setResolving(false);
      const panel = this.stepContent[stepIndex];
      if (forward && (panel === "distribution" || panel === "confirmation")) {
        this.resolveSelectionsForDownstream();
      }
    },
    resolvePayload() {
      return {
        assignmentType: this.assignmentType,
        newStudyOwner: this.workflowMappingStepModalValue?.newStudyOwner ?? "session_owner",
        selectedAssignments: this.assignmentModalValue,
        selectedReviewer: this.selectedReviewer,
        ...this.liveSelections(),
      };
    },
    /**
     * Query-table selections (select-all included) from the mounted steps, else those stored when the
     * steps were left. Documents are plain row arrays, so only submissions and sessions carry one.
     */
    liveSelections() {
      const live = stepRef => this.$refs[stepRef]?.getSelection?.();
      return {
        ...(this.assignmentType !== "document" && {
          assignmentSelection: {...(live("assignmentSelectionStep") || this.assignmentSelection)},
        }),
        reviewerQuerySelection: {...(live("reviewerSelectionStep") || this.reviewerQuerySelection)},
      };
    },
    setResolving(value) {
      this.resolveLoading = value;
      this.$refs.assignmentStepper?.setWaiting?.(value);
    },
    resolveSelectionsForDownstream() {
      if (this.resolveLoading) return;
      this.setResolving(true);
      this.$socket.emit("assignmentBulkResolveSelection", this.resolvePayload(), (res) => {
        this.setResolving(false);
        if (!res?.success) {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.study.failedToCreateAssignment"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        this.assignmentModalValue = res.data?.selectedAssignments || [];
        this.selectedReviewer = res.data?.selectedReviewer || [];
      });
    },
    onSubmit() {
      const progressId = this.$refs.assignmentStepper.startProgress();
      this.$refs.confirmationStep.submit(progressId, this.resolvePayload());
    },
    onSettled(success) {
      this.$refs.assignmentStepper.stopProgress();
      if (success) this.$refs.assignmentStepper.close();
    },
  },
};
</script>
