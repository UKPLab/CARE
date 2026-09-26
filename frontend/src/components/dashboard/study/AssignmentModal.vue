<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="bulk ? createBulkAssignments() : createSingleAssignment()"
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

    <!-- ─── Step 1: Template Selection ──────────────────────────────────────── -->
    <template #step-1>
      <TemplateSelectionStep
          :key="`template-step-${stepResetKey}`"
          ref="templateSelectionStep"
          :modal-value="templateStepModalValue"
          @update:modal-value="templateStepModalValue = $event"
          @update:assignmentType="assignmentType = $event"
          @update:workflowSteps="workflowSteps = $event"
          @update:workflowStepsAssignment="workflowStepsAssignment = $event"
          @update:template="template = $event"
          @update:workflow="workflow = $event"
          @update:isValid="templateValid = $event"
      />
    </template>

    <!-- ─── Step 2: Workflow Mapping (study_session) | Assignment Selection (doc/sub) ── -->
    <template #step-2>
      <WorkflowMappingStep
          v-if="stepContent[1] === 'workflow-mapping'"
          :key="`workflow-mapping-step-${stepResetKey}`"
          ref="workflowMappingStep"
          :workflow-steps="workflowSteps"
          :bulk="bulk"
          :modal-value="workflowMappingStepModalValue"
          @update:modalValue="workflowMappingStepModalValue = $event"
          @update:isWorkflowMappingComplete="isWorkflowMappingComplete = $event"
          @update:isValid="workflowMappingValid = $event"
      />
      <AssignmentSelectionStep
          v-else
          :key="`assignment-step2-${stepResetKey}`"
          ref="assignmentSelectionStep2"
          :modalValue="assignmentModalValue"
          @update:modalValue="assignmentModalValue = $event"
          @update:selectedAssignmentUserIds="selectedAssignmentUserIds = $event"
          @update:isValid="assignmentSelectionValid = $event"
      />
    </template>

    <!-- ─── Step 3: Session Selection (study_session) | Reviewer Selection (doc/sub) ─── -->
    <template #step-3>
      <AssignmentSelectionStep
          v-if="stepContent[2] === 'session-selection'"
          :key="`assignment-step3-${stepResetKey}`"
          ref="assignmentSelectionStep3"
          :modalValue="assignmentModalValue"
          :initial-selection="assignmentSelection"
          @update:modalValue="assignmentModalValue = $event"
          @update:selectedAssignmentUserIds="selectedAssignmentUserIds = $event"
          @update:selection="onAssignmentSelection"
          @update:isValid="assignmentSelectionValid = $event"
      />
      <ReviewerSelectionStep
          v-else
          :key="`reviewer-step3-${stepResetKey}`"
          ref="reviewerSelectionStep3"
          :selected-assignment-user-ids="selectedAssignmentUserIds"
          :assignment-selection="assignmentSelection"
          :initial-selection="reviewerQuerySelection"
          :bulk="bulk"
          @update:selection="onReviewerSelection"
          @update:isValid="reviewerSelectionValid = $event"
      />
    </template>

    <!-- ─── Step 4: Reviewer Selection (session) | Distribution (non-session bulk) | Confirmation (non-session single) ─── -->
    <template #step-4>
      <ReviewerSelectionStep
          v-if="stepContent[3] === 'reviewer-selection'"
          :key="`reviewer-step4-${stepResetKey}`"
          ref="reviewerSelectionStep4"
          :selected-assignment-user-ids="selectedAssignmentUserIds"
          :assignment-selection="assignmentSelection"
          :initial-selection="reviewerQuerySelection"
          :bulk="bulk"
          @update:selection="onReviewerSelection"
          @update:isValid="reviewerSelectionValid = $event"
      />
      <DistributionStep
          v-else-if="stepContent[3] === 'distribution'"
          :key="`distribution-step4-${stepResetKey}`"
          ref="distributionStep4"
          :modal-value="distributionModalValue"
          @update:reviewerSelectionMode="reviewerSelectionMode = $event"
          @update:roleSelection="roleSelection = $event"
          @update:reviewerSelection="reviewerSelection = $event"
          @update:selectionValid="selectionValid = $event"
          @update:numberOfReviews="numberOfReviews = $event"
          @update:isValid="distributionValid = $event"
      />
      <ConfirmationStep
          v-else
          variant="doc-sub-single"
      />
    </template>

    <!-- ─── Step 5: Distribution (session bulk) | Confirmation (session single or non-session bulk) ─── -->
    <template #step-5>
      <DistributionStep
          v-if="stepContent[4] === 'distribution'"
          :key="`distribution-step5-${stepResetKey}`"
          ref="distributionStep5"
          :modal-value="distributionModalValue"
          @update:reviewerSelectionMode="reviewerSelectionMode = $event"
          @update:roleSelection="roleSelection = $event"
          @update:reviewerSelection="reviewerSelection = $event"
          @update:selectionValid="selectionValid = $event"
          @update:numberOfReviews="numberOfReviews = $event"
          @update:isValid="distributionValid = $event"
      />
      <ConfirmationStep
          v-else-if="assignmentType === 'study_session'"
          variant="session-single"
      />
      <ConfirmationStep
          v-else
          variant="doc-sub-bulk"
      />
    </template>

    <!-- ─── Step 6: Bulk confirmation for session+bulk (only rendered for 6-step flow) ─── -->
    <template #step-6>
      <ConfirmationStep variant="session-bulk" />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils";
import { computed } from "vue";
import TemplateSelectionStep from "./assignment/TemplateSelectionStep.vue";
import WorkflowMappingStep from "./assignment/WorkflowMappingStep.vue";
import AssignmentSelectionStep from "./assignment/AssignmentSelectionStep.vue";
import ReviewerSelectionStep from "./assignment/ReviewerSelectionStep.vue";
import DistributionStep from "./assignment/DistributionStep.vue";
import ConfirmationStep from "./assignment/ConfirmationStep.vue";
import {emptySelection} from "@/basic/table/emptySelection.js";

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
    {
      table: "submission",
      inject: [{
        type: "parent",
        table: "user",
        by: "userId",
        fields: ["firstName", "lastName", "userName"],
      }],
    },
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
      reviewerSelectionMode: computed(() => this.reviewerSelectionMode),
      workflowStepsAssignments: computed(() => this.workflowStepsAssignments),
      numberOfReviews: computed(() => this.numberOfReviews),
      reviewerSelectionModeFields: computed(() => this.reviewerSelectionModeFields),
      reviewer: computed(() => this.selectedReviewer),
      documents: computed(() => this.documents),
      roles: computed(() => this.roles),
      roleSelection: computed(() => this.roleSelection),
      reviewerSelection: computed(() => this.reviewerSelection),
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
      workflowStepsAssignment: [],
      template: null,
      workflow: null,
      templateStepModalValue: {},

      // Step 2: WorkflowMappingStep
      workflowMappingStepModalValue: {},
      isWorkflowMappingComplete: false,

      // Step 2/3: AssignmentSelectionStep
      assignmentModalValue: [],
      selectedAssignmentUserIds: [],
      assignmentSelection: emptySelection(),
      reviewerQuerySelection: emptySelection(),

      // Step 3/4: ReviewerSelectionStep
      selectedReviewer: [],
      selectedReviewerRoles: [],

      // Step 4/5: DistributionStep
      reviewerSelectionMode: {},
      roleSelection: {},
      reviewerSelection: {},
      selectionValid: false,
      numberOfReviews: 0,

      // Step validity (emitted from children)
      templateValid: false,
      workflowMappingValid: false,
      assignmentSelectionValid: false,
      reviewerSelectionValid: false,
      distributionValid: false,

      resolveLoading: false,
    };
  },
  computed: {
    // Store lookups used by parent (passed as props to ConfirmationStep and DistributionStep)
    templates() {
      return this.$store.getters["table/study/getFiltered"](item => item.template === true);
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    assignmentCount() {
      if (this.assignmentType === 'study_session') {
        return this.assignmentSelection.count || this.assignmentModalValue.length;
      }
      return this.assignmentModalValue.length;
    },
    reviewerCount() {
      return this.reviewerQuerySelection.count || this.selectedReviewer.length;
    },
    reviewerSelectionModeFields() {
      const baseOptions = [
        {
          name: this.$t("dashboard.study.roleBasedSelection"),
          value: "role",
        },
        {
          name: this.$t("dashboard.study.reviewerBasedSelection"),
          value: "reviewer",
        },
      ];
      if (this.assignmentType === 'study_session') {
        baseOptions.push({
          name: this.$t("dashboard.study.sessionUserBasedSelection"),
          value: "session_user",
        });
      }
      return [
        {
          key: "mode",
          label: this.$t("dashboard.study.reviewerSelectionMode"),
          type: "select",
          options: baseOptions,
          required: true,
        },
      ];
    },
    stepContent() {
      const isSession = this.assignmentType === 'study_session';
      if (isSession) {
        return this.bulk
          ? ['template', 'workflow-mapping', 'session-selection', 'reviewer-selection', 'distribution', 'confirmation']
          : ['template', 'workflow-mapping', 'session-selection', 'reviewer-selection', 'confirmation'];
      }
      return this.bulk
        ? ['template', 'assignment-selection', 'reviewer-selection', 'distribution', 'confirmation']
        : ['template', 'assignment-selection', 'reviewer-selection', 'confirmation'];
    },
    stepValid() {
      return this.stepContent.map(panel => {
        switch (panel) {
          case 'template': return this.templateValid;
          case 'workflow-mapping': return this.workflowMappingValid;
          case 'assignment-selection': return this.assignmentSelectionValid;
          case 'session-selection': return this.assignmentSelectionValid;
          case 'reviewer-selection': return this.reviewerSelectionValid;
          case 'distribution': return this.distributionValid;
          case 'confirmation': return true;
          default: return true;
        }
      });
    },
    steps() {
      const isSession = this.assignmentType === 'study_session';
      if (isSession) {
        return [
          { title: this.$t("dashboard.study.templateSelection") },
          { title: this.$t("dashboard.study.workflowMapping") },
          { title: this.$t("dashboard.study.studySessionSelection") },
          { title: this.$t("dashboard.study.reviewerSelection") },
          ...(this.bulk ? [{ title: this.$t("dashboard.study.distribution") }] : []),
          { title: this.$t("common.confirmation") },
        ];
      }
      const selectionTitle = this.assignmentType === "submission"
        ? this.$t("dashboard.study.submissionSelection")
        : this.$t("dashboard.study.documentSelection");
      return [
        { title: this.$t("dashboard.study.templateSelection") },
        { title: selectionTitle },
        { title: this.$t("dashboard.study.reviewerSelection") },
        ...(this.bulk ? [{ title: this.$t("dashboard.study.distribution") }] : []),
        { title: this.$t("common.confirmation") },
      ];
    },
    distributionModalValue() {
      return {
        reviewerSelectionMode: this.reviewerSelectionMode,
        roleSelection: this.roleSelection,
        reviewerSelection: this.reviewerSelection,
      };
    },
    workflowStepsAssignments() {
      if (this.assignmentType === "submission") {
        return this.assignmentModalValue.map((submission) => {
          return this.workflowSteps.map((c, index) => {
            if (index === 0) {
              const primaryDocId = this.getPrimaryDocumentId(submission.id);
              return { documentId: primaryDocId, workflowStepId: c.id };
            }
            return { documentId: null, workflowStepId: c.id };
          });
        });
      }
      return this.assignmentModalValue.map((document) => {
        return this.workflowSteps.map((c, index) => ({
          documentId: index === 0 ? document.id : null,
          workflowStepId: c.id,
        }));
      });
    },
  },
  methods: {
    getPrimaryDocumentId(submissionId) {
      const submission = this.$store.getters["table/submission/get"](submissionId);
      const configuration = this.$store.getters["table/configuration/get"](submission.validationConfigurationId);
      const docs = this.$store.getters["table/document/getFiltered"](
          d => d.submissionId === submissionId && !d.deleted && d.type === 0
      );
      if (!docs || docs.length === 0) return null;
      if (configuration && configuration.primaryDocument) {
        const primaryDoc = docs.find(d => d.id === configuration.primaryDocument);
        if (primaryDoc) return primaryDoc.id;
      }
      return docs[0].id;
    },
    open(bulk = true) {
      this.bulk = bulk;
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.stepResetKey++;
      this.assignmentType = "document";
      this.workflowSteps = [];
      this.workflowStepsAssignment = [];
      this.template = null;
      this.workflow = null;
      this.templateStepModalValue = {};
      this.workflowMappingStepModalValue = {};
      this.isWorkflowMappingComplete = false;
      this.assignmentModalValue = [];
      this.selectedAssignmentUserIds = [];
      this.assignmentSelection = emptySelection();
      this.reviewerQuerySelection = emptySelection();
      this.selectedReviewer = [];
      this.selectedReviewerRoles = [];
      this.reviewerSelectionMode = {};
      this.roleSelection = {};
      this.reviewerSelection = {};
      this.selectionValid = false;
      this.numberOfReviews = 0;
      this.templateValid = false;
      this.workflowMappingValid = false;
      this.assignmentSelectionValid = false;
      this.reviewerSelectionValid = false;
      this.distributionValid = false;
    },
    onAssignmentSelection(selection) {
      this.assignmentSelection = selection ? {...selection} : emptySelection();
    },
    onReviewerSelection(selection) {
      this.reviewerQuerySelection = selection ? {...selection} : emptySelection();
    },
    /**
     * Before Distribution / Confirm: turn queryTable selection (including select-all)
     * into row arrays. Distribution still builds sliders from selectedReviewer objects.
     */
    onStepChange(stepIndex) {
      const panel = this.stepContent[stepIndex];
      if (panel === "distribution" || panel === "confirmation") {
        this.resolveSelectionsForDownstream();
      }
    },
    resolvePayload() {
      const payload = {
        assignmentType: this.assignmentType,
        newStudyOwner: this.workflowMappingStepModalValue?.newStudyOwner ?? "session_owner",
        selectedAssignments: this.assignmentModalValue,
        selectedReviewer: this.selectedReviewer,
        reviewerQuerySelection: this.snapshotReviewerSelection(),
      };
      if (this.assignmentType === "study_session") {
        payload.assignmentSelection = this.snapshotAssignmentSelection();
      }
      return payload;
    },
    snapshotAssignmentSelection() {
      const live = this.$refs.assignmentSelectionStep3?.getSelection?.();
      return live ? {...live} : {...this.assignmentSelection};
    },
    snapshotReviewerSelection() {
      const ref = this.$refs.reviewerSelectionStep3 || this.$refs.reviewerSelectionStep4;
      const live = ref?.getSelection?.();
      return live ? {...live} : {...this.reviewerQuerySelection};
    },
    resolveSelectionsForDownstream() {
      // Reviewers always come from BackendTable, so resolve them into rows before
      // Distribution / Confirmation. Sessions only for the study_session path;
      // documents / submissions stay the Vuex rows in selectedAssignments.
      if (this.resolveLoading) {
        return;
      }
      this.resolveLoading = true;
      this.$refs.assignmentStepper?.setWaiting?.(true);
      this.$socket.emit("assignmentBulkResolveSelection", this.resolvePayload(), (res) => {
        this.resolveLoading = false;
        this.$refs.assignmentStepper?.setWaiting?.(false);
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
        this.selectedReviewerRoles = [...new Set(
          this.selectedReviewer.flatMap((user) => user.roles || [])
        )];
      });
    },
    onSuccess() {
      this.$refs.assignmentStepper.close();
      this.eventBus.emit("toast", {
        title: this.$t("dashboard.study.assignmentCreated"),
        message: this.$t("dashboard.study.assignmentCreatedMessage"),
        variant: "success",
      });
    },
    onError(res) {
      this.$refs.assignmentStepper.stopProgress();
      this.eventBus.emit("toast", {
        title: this.$t("dashboard.study.failedToCreateAssignment"),
        message: resolveApiMessage(res),
        variant: "danger",
      });
    },
    createSingleAssignment() {
      this.$refs.assignmentStepper.startProgress();

      this.$socket.emit("assignmentBulkResolveSelection", this.resolvePayload(), (resolveRes) => {
        if (!resolveRes?.success) {
          this.onError(resolveRes);
          return;
        }
        const assignments = resolveRes.data?.selectedAssignments?.length
          ? resolveRes.data.selectedAssignments
          : this.assignmentModalValue;
        const reviewers = resolveRes.data?.selectedReviewer?.length
          ? resolveRes.data.selectedReviewer
          : this.selectedReviewer;

        const socketData = {
          template: this.template,
          selectedAssignments: assignments,
          reviewer: reviewers,
          assignmentType: this.assignmentType,
          enableEmailNotification: this.templateStepModalValue?.enableEmailNotification ?? false,
          newStudyOwner: this.workflowMappingStepModalValue?.newStudyOwner ?? "session_owner",
        };

        if (this.assignmentType === "study_session") {
          socketData.workflowMapping = this.workflowMappingStepModalValue?.workflowMapping;
        } else {
          socketData.documents = this.workflowStepsAssignments[0];
        }

        this.$socket.emit("assignmentCreateSingle", socketData, (res) => {
          this.$refs.assignmentStepper.stopProgress();
          if (res.success) {
            this.onSuccess();
          } else {
            this.onError(res);
          }
        });
      });
    },
    createBulkAssignments() {
      const progressId = this.$refs.assignmentStepper.startProgress();

      const socketData = {
        template: this.template,
        selectedReviewer: this.selectedReviewer,
        selectedAssignments: this.assignmentModalValue,
        reviewerSelection: this.reviewerSelection,
        roleSelection: this.roleSelection,
        mode: this.reviewerSelectionMode.mode,
        roles: this.roles,
        assignmentType: this.assignmentType,
        enableEmailNotification: this.templateStepModalValue?.enableEmailNotification ?? false,
        progressId: progressId,
        newStudyOwner: this.workflowMappingStepModalValue?.newStudyOwner ?? "session_owner",
        reviewerQuerySelection: this.snapshotReviewerSelection(),
      };

      if (this.assignmentType === "study_session") {
        socketData.targetWorkflowId = this.workflowMappingStepModalValue?.targetWorkflowId;
        socketData.workflowMapping = this.workflowMappingStepModalValue?.workflowMapping;
        socketData.assignmentSelection = this.snapshotAssignmentSelection();
      } else {
        socketData.documents = this.workflowStepsAssignments;
      }

      this.$socket.emit("assignmentCreateBulk", socketData, (res) => {
        this.$refs.assignmentStepper.stopProgress();
        if (res.success) {
          if (this.reviewerSelectionMode.mode === "role") {
            const filename = "assignments";
            const csvRows = res.data?.csvRows;
            if (Array.isArray(csvRows)) {
              downloadObjectsAs(csvRows, filename, "csv");
            } else {
              const distribution = res.data?.distribution || res.data || {};
              const returnData = Object.keys(distribution).map((assignmentId) => {
                const assignmentUser = this.assignmentModalValue.find((u) => u.id === Number(assignmentId));
                if (!assignmentUser) {
                  return null;
                }
                const csv = {
                  assignedToName: `${assignmentUser.firstName} ${assignmentUser.lastName}`,
                  assignedToFirstName: assignmentUser.firstName,
                  assignedToLastName: assignmentUser.lastName,
                };
                distribution[assignmentId].forEach((reviewerId, index) => {
                  const reviewerUser = this.selectedReviewer.find((u) => u.id === Number(reviewerId));
                  csv[`reviewer_${index + 1}`] = reviewerUser
                    ? `${reviewerUser.firstName} ${reviewerUser.lastName}` : "";
                });
                return csv;
              }).filter(Boolean);
              downloadObjectsAs(returnData, filename, "csv");
            }
          }
          this.onSuccess();
        } else {
          this.onError(res);
        }
      });
    },
  },
};
</script>
