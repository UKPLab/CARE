<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="bulk ? createBulkAssignments() : createSingleAssignment()">
    <template #title>
      <h5 class="modal-title">{{ bulk ? 'Create Bulk Assignment' : 'Create Single Assignment' }}</h5>
    </template>

    <template v-if="templates.length === 0" #error>
      <p class="text-center text-danger">There are not study templates available!</p>
      <p class="text-center">Please create a study template to proceed!</p>
    </template>

    <!-- ─── Step 1: Template Selection ──────────────────────────────────────── -->
    <template #step-1>
      <TemplateSelectionStep
          :key="`template-step-${stepResetKey}`"
          ref="templateSelectionStep"
          :modal-value="templateStepModalValue"
          @update:modalValue="templateStepModalValue = $event"
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
          @update:modalValue="assignmentModalValue = $event"
          @update:selectedAssignmentUserIds="selectedAssignmentUserIds = $event"
          @update:isValid="assignmentSelectionValid = $event"
      />
      <ReviewerSelectionStep
          v-else
          :key="`reviewer-step3-${stepResetKey}`"
          ref="reviewerSelectionStep3"
          :selected-assignment-user-ids="selectedAssignmentUserIds"
          :bulk="bulk"
          :modalValue="selectedReviewer"
          @update:selectedReviewer="selectedReviewer = $event"
          @update:selectedReviewerRoles="selectedReviewerRoles = $event"
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
          :bulk="bulk"
          :modalValue="selectedReviewer"
          @update:selectedReviewer="selectedReviewer = $event"
          @update:selectedReviewerRoles="selectedReviewerRoles = $event"
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
import { downloadObjectsAs } from "@/assets/utils";
import { computed } from "vue";
import TemplateSelectionStep from "./assignment/TemplateSelectionStep.vue";
import WorkflowMappingStep from "./assignment/WorkflowMappingStep.vue";
import AssignmentSelectionStep from "./assignment/AssignmentSelectionStep.vue";
import ReviewerSelectionStep from "./assignment/ReviewerSelectionStep.vue";
import DistributionStep from "./assignment/DistributionStep.vue";
import ConfirmationStep from "./assignment/ConfirmationStep.vue";

/**
 * Modal for bulk creating assignments
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
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
  props: {
    bulk: {
      type: Boolean,
      default: true,
    },
  },
  subscribeTable: [
    { table: "document", filter: [{ key: "readyForReview", value: true }] },
    { table: "user" },
    { table: "study", filter: [{ key: "template", value: true }] },
    "submission",
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
      reviewer: computed(() => this.reviewer),
      documents: computed(() => this.documents),
      roles: computed(() => this.roles),
      roleSelection: computed(() => this.roleSelection),
      reviewerSelection: computed(() => this.reviewerSelection),
    };
  },
  data() {
    return {

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
    };
  },
  computed: {
    // Store lookups used by parent (passed as props to ConfirmationStep and DistributionStep)
    templates() {
      return this.$store.getters["table/study/getFiltered"](item => item.template === true);
    },
    reviewer() {
      return this.$store.getters["table/user/getAll"];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    reviewerSelectionModeFields() {
      const baseOptions = [
        {
          name: "Role-based selection (the number of documents that should be reviewed by each user of the selected roles)",
          value: "role",
        },
        {
          name: "Reviewer-based selection (distribute document between the selected reviewers)",
          value: "reviewer",
        },
      ];
      if (this.assignmentType === 'study_session') {
        baseOptions.push({
          name: "Session user-based selection (assign each study session to its original user)",
          value: "session_user",
        });
      }
      return [
        {
          key: "mode",
          label: "Reviewer Selection Mode",
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
          { title: "Template Selection" },
          { title: "Workflow Mapping" },
          { title: "Study Session Selection" },
          { title: "Reviewer Selection" },
          ...(this.bulk ? [{ title: "Distribution" }] : []),
          { title: "Confirmation" },
        ];
      }
      const selectionTitle = this.assignmentType === 'submission' ? "Submission Selection" : "Document Selection";
      return [
        { title: "Template Selection" },
        { title: selectionTitle },
        { title: "Reviewer Selection" },
        ...(this.bulk ? [{ title: "Distribution" }] : []),
        { title: "Confirmation" },
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
      if (this.assignmentType === 'submission') {
        return this.assignmentModalValue.map(submission => {
          return this.workflowSteps.map((c, index) => {
            if (index === 0) {
              const primaryDocId = this.getPrimaryDocumentId(submission.id);
              return { documentId: primaryDocId, workflowStepId: c.id };
            }
            return { documentId: null, workflowStepId: c.id };
          });
        });
      }
      return this.assignmentModalValue.map(document => {
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
    open() {
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.stepResetKey++;

      this.assignmentType = 'document';
      this.workflowSteps = [];
      this.workflowStepsAssignment = [];
      this.template = null;
      this.workflow = null;
      this.templateStepModalValue = {};
      this.workflowMappingStepModalValue = {};
      this.isWorkflowMappingComplete = false;
      this.assignmentModalValue = [];
      this.selectedAssignmentUserIds = [];
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
    onSuccess() {
      this.$refs.assignmentStepper.close();
      this.eventBus.emit("toast", {
        title: "Assignment created",
        message: "The assignment has been created successfully",
        variant: "success",
      });
    },
    onError(res) {
      this.$refs.assignmentStepper.stopProgress();
      this.eventBus.emit("toast", {
        title: "Failed to create assignment",
        message: res.message,
        variant: "danger",
      });
    },
    createSingleAssignment() {
      this.$refs.assignmentStepper.startProgress();

      const socketData = {
        template: this.template,
        selectedAssignments: this.assignmentModalValue,
        reviewer: this.selectedReviewer,
        assignmentType: this.assignmentType,
        enableEmailNotification: this.templateStepModalValue?.enableEmailNotification ?? false,
      };

      if (this.assignmentType === 'study_session') {
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
      };

      if (this.assignmentType === 'study_session') {
        socketData.targetWorkflowId = this.workflowMappingStepModalValue?.targetWorkflowId;
        socketData.workflowMapping = this.workflowMappingStepModalValue?.workflowMapping;
      } else {
        socketData.documents = this.workflowStepsAssignments;
      }

      this.$socket.emit("assignmentCreateBulk", socketData, (res) => {
        this.$refs.assignmentStepper.stopProgress();
        if (res.success) {
          if (this.reviewerSelectionMode.mode === 'role') {
            const filename = "assignments";
            const allUsers = this.reviewer;
            const returnData = Object.keys(res.data).map(assignmentId => {
              const assignmentUser = allUsers.find(u => u.id === Number(assignmentId));
              if (!assignmentUser) {
                console.error(`Assignment with ID ${assignmentId} not found.`);
                return null;
              }
              const csv = {
                assignedToName: `${assignmentUser.firstName} ${assignmentUser.lastName}`,
                assignedToFirstName: assignmentUser.firstName,
                assignedToLastName: assignmentUser.lastName,
              };
              res.data[assignmentId].forEach((reviewerId, index) => {
                const reviewerUser = allUsers.find(u => u.id === Number(reviewerId));
                csv[`reviewer_${index + 1}`] = reviewerUser
                  ? `${reviewerUser.firstName} ${reviewerUser.lastName}` : '';
              });
              return csv;
            });
            downloadObjectsAs(returnData, filename, "csv");
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
