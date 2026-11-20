<template>
  <div>
    <!-- doc-sub-single -->
    <template v-if="variant === 'doc-sub-single'">
      <p>{{ $t('dashboard.study.createAssignmentConfirmPrompt') }}</p>
      <div><strong>{{ $t('dashboard.study.template') }}</strong> {{ template && template.name }}</div>
      <div><strong>{{ $t('dashboard.study.workflow') }}</strong> {{ workflow && workflow.name }}</div>
      <div>
        <strong>{{ $t('dashboard.study.assignmentType') }}</strong>
        {{ assignmentType === 'document' ? $t('dashboard.study.typeDocument') : $t('dashboard.study.typeSubmission') }}
      </div>
      <div v-if="assignmentType === 'document'">
        <strong>{{ $t('dashboard.study.workflowAssignments') }}</strong>
        <ul>
          <li v-for="(stepAssignment, index) in workflowStepsAssignments[0]" :key="stepAssignment.workflowStepId">
            - {{ $t('dashboard.study.workflowStepWithIndex', { index: index + 1 }) }}
            <span v-if="stepAssignment.documentId && getDoc(stepAssignment.documentId)">
              {{ getDoc(stepAssignment.documentId).name }}
              ({{ getDocReviewerName(stepAssignment) }})
            </span>
            <span v-else>{{ $t('dashboard.study.createNewDocument') }}</span>
          </li>
        </ul>
      </div>
      <div>
        <strong>{{ $t('dashboard.study.reviewers') }}</strong>
        <ul>
          <li v-for="rev in selectedReviewer" :key="rev.id">- {{ rev.firstName }} {{ rev.lastName }}</li>
        </ul>
      </div>
    </template>

    <!-- session-single -->
    <template v-else-if="variant === 'session-single'">
      <p>{{ $t('dashboard.study.createAssignmentConfirmPrompt') }}</p>
      <div><strong>{{ $t('dashboard.study.template') }}</strong> {{ template && template.name }}</div>
      <div><strong>{{ $t('dashboard.study.workflow') }}</strong> {{ workflow && workflow.name }}</div>
      <div><strong>{{ $t('dashboard.study.assignmentType') }}</strong> {{ $t('dashboard.study.typeStudySession') }}</div>
      <div><strong>{{ $t('dashboard.study.targetWorkflow') }}:</strong> {{ targetWorkflowName }}</div>
      <div>
        <strong>{{ $t('dashboard.study.selectedStudySession') }}:</strong>
        {{ selectedAssignments.length > 0
          ? $t('dashboard.study.sessionWithId', { id: selectedAssignments[0].id })
          : $t('common.none') }}
      </div>
      <div>
        <strong>{{ $t('dashboard.study.reviewers') }}</strong>
        <ul>
          <li v-for="rev in selectedReviewer" :key="rev.id">- {{ rev.firstName }} {{ rev.lastName }}</li>
        </ul>
      </div>
    </template>

    <!-- doc-sub-bulk or session-bulk (shared bulk summary layout) -->
    <BulkAssignmentSummary v-else />
  </div>
</template>

<script>
import BulkAssignmentSummary from "./BulkAssignmentSummary.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils";

/**
 * Final confirmation step of the assignment wizard. Displays a read-only summary of all
 * choices made in previous steps and owns the create request: the wizard calls submit()
 * when the user confirms, and this step emits "settled" with the outcome.
 * Supports four variants: doc-sub-single, doc-sub-bulk, session-single, and session-bulk.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "ConfirmationStep",
  components: { BulkAssignmentSummary },
  inject: {
    bulk: { type: Boolean, required: false, default: true },
    template: { type: Object, required: false, default: null },
    workflow: { type: Object, required: false, default: null },
    assignmentType: { type: String, required: false, default: 'document' },
    targetWorkflowId: { type: Number, required: false, default: null },
    newStudyOwner: { type: String, required: false, default: 'session_owner' },
    selectedAssignments: { type: Array, required: false, default: () => [] },
    selectedReviewer: { type: Array, required: false, default: () => [] },
    reviewerSelectionMode: { type: Object, required: false, default: () => ({}) },
    workflowSteps: { type: Array, required: false, default: () => [] },
    roles: { type: Array, required: false, default: () => [] },
    roleSelection: { type: Object, required: false, default: () => ({}) },
    reviewerSelection: { type: Object, required: false, default: () => ({}) },
  },
  props: {
    variant: {
      type: String,
      required: true,
      validator: v => ['doc-sub-single', 'doc-sub-bulk', 'session-single', 'session-bulk'].includes(v),
    },
    enableEmailNotification: { type: Boolean, required: false, default: false },
    workflowMapping: { type: Object, required: false, default: undefined },
  },
  emits: ["settled"],
  computed: {
    documents() {
      return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
    },
    // Document path only. Submissions get their step document on the server (createAssignment).
    workflowStepsAssignments() {
      if (this.assignmentType !== "document") return [];
      return this.selectedAssignments.map((document) => this.workflowSteps.map((step, index) => ({
        documentId: index === 0 ? document.id : null,
        workflowStepId: step.id,
      })));
    },
    targetWorkflowName() {
      if (!this.targetWorkflowId) return this.$t("common.unknown");
      const workflow = this.$store.getters["table/workflow/get"](this.targetWorkflowId);
      return workflow ? workflow.name : this.$t("common.unknown");
    },
  },
  methods: {
    getDoc(documentId) {
      return this.documents.find(doc => doc.id === documentId);
    },
    getDocReviewerName(stepAssignment) {
      // Document owner name comes from the fields injected onto the document row
      const doc = this.getDoc(stepAssignment.documentId);
      if (!doc) return '';
      return `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
    },
    /**
     * Creates the assignment(s). Called by the wizard on confirm.
     * @param {string} progressId - Stepper progress id, forwarded to the bulk request.
     * @param {Object} selection - Resolve payload incl. live query-table selection snapshots.
     */
    submit(progressId, selection) {
      if (this.bulk) {
        this.createBulkAssignments(progressId, selection);
      } else {
        this.createSingleAssignment(selection);
      }
    },
    settle(res) {
      this.eventBus.emit("toast", res?.success ? {
        title: this.$t("dashboard.study.assignmentCreated"),
        message: this.$t("dashboard.study.assignmentCreatedMessage"),
        variant: "success",
      } : {
        title: this.$t("dashboard.study.failedToCreateAssignment"),
        message: resolveApiMessage(res),
        variant: "danger",
      });
      this.$emit("settled", !!res?.success);
    },
    createSingleAssignment(selection) {
      this.$socket.emit("assignmentBulkResolveSelection", selection, (resolveRes) => {
        if (!resolveRes?.success) {
          this.settle(resolveRes);
          return;
        }
        const socketData = {
          template: this.template,
          selectedAssignments: resolveRes.data?.selectedAssignments?.length
            ? resolveRes.data.selectedAssignments
            : this.selectedAssignments,
          reviewer: resolveRes.data?.selectedReviewer?.length
            ? resolveRes.data.selectedReviewer
            : this.selectedReviewer,
          assignmentType: this.assignmentType,
          enableEmailNotification: this.enableEmailNotification,
          newStudyOwner: this.newStudyOwner,
        };
        if (this.assignmentType === "study_session") {
          socketData.workflowMapping = this.workflowMapping;
        } else if (this.assignmentType === "document") {
          socketData.documents = this.workflowStepsAssignments[0];
        }
        this.$socket.emit("assignmentCreateSingle", socketData, (res) => this.settle(res));
      });
    },
    createBulkAssignments(progressId, selection) {
      const socketData = {
        template: this.template,
        selectedReviewer: this.selectedReviewer,
        selectedAssignments: this.selectedAssignments,
        reviewerSelection: this.reviewerSelection,
        roleSelection: this.roleSelection,
        mode: this.reviewerSelectionMode.mode,
        roles: this.roles,
        assignmentType: this.assignmentType,
        enableEmailNotification: this.enableEmailNotification,
        progressId: progressId,
        newStudyOwner: this.newStudyOwner,
        reviewerQuerySelection: selection.reviewerQuerySelection,
      };
      if (this.assignmentType === "study_session") {
        socketData.targetWorkflowId = this.targetWorkflowId;
        socketData.workflowMapping = this.workflowMapping;
        socketData.assignmentSelection = selection.assignmentSelection;
      } else if (this.assignmentType === "submission") {
        // Server resolves the submissions and picks each one's PDF itself.
        socketData.assignmentSelection = selection.assignmentSelection;
      } else {
        socketData.documents = this.workflowStepsAssignments;
      }
      this.$socket.emit("assignmentCreateBulk", socketData, (res) => {
        if (res.success && this.reviewerSelectionMode.mode === "role" && Array.isArray(res.data?.csvRows)) {
          downloadObjectsAs(res.data.csvRows, "assignments", "csv");
        }
        this.settle(res);
      });
    },
  },
};
</script>
