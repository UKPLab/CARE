<template>
  <div>
    <!-- doc-sub-single -->
    <template v-if="variant === 'doc-sub-single'">
      <p>Are you sure you want to create the assignment with the following details?</p>
      <div><strong>Template:</strong> {{ template && template.name }}</div>
      <div><strong>Workflow:</strong> {{ workflow && workflow.name }}</div>
      <div><strong>Assignment Type:</strong> {{ assignmentType === 'document' ? 'Document' : 'Submission' }}</div>
      <div v-if="assignmentType === 'document'">
        <strong>Workflow Assignments:</strong>
        <ul>
          <li v-for="(stepAssignment, index) in workflowStepsAssignments[0]" :key="stepAssignment.workflowStepId">
            - Workflow Step {{ index + 1 }}:
            <span v-if="stepAssignment.documentId && documents.find(doc => doc.id === stepAssignment.documentId)">
              {{ documents.find(doc => doc.id === stepAssignment.documentId).name }}
              ({{ reviewer.find(u => u.id === documents.find(doc => doc.id === stepAssignment.documentId).userId)?.firstName }}
               {{ reviewer.find(u => u.id === documents.find(doc => doc.id === stepAssignment.documentId).userId)?.lastName }})
            </span>
            <span v-else>Create new document</span>
          </li>
        </ul>
      </div>
      <div>
        <strong>Reviewers:</strong>
        <ul>
          <li v-for="rev in selectedReviewer" :key="rev.id">- {{ rev.firstName }} {{ rev.lastName }}</li>
        </ul>
      </div>
    </template>

    <!-- session-single -->
    <template v-else-if="variant === 'session-single'">
      <p>Are you sure you want to create the assignment with the following details?</p>
      <div><strong>Template:</strong> {{ template && template.name }}</div>
      <div><strong>Workflow:</strong> {{ workflow && workflow.name }}</div>
      <div><strong>Assignment Type:</strong> Study Session</div>
      <div><strong>Target Workflow:</strong> {{ targetWorkflowName }}</div>
      <div>
        <strong>Selected Study Session:</strong>
        {{ selectedAssignments.length > 0 ? `Session ${selectedAssignments[0].id}` : 'None' }}
      </div>
      <div>
        <strong>Reviewers:</strong>
        <ul>
          <li v-for="rev in selectedReviewer" :key="rev.id">- {{ rev.firstName }} {{ rev.lastName }}</li>
        </ul>
      </div>
    </template>

    <!-- doc-sub-bulk or session-bulk (shared bulk summary layout) -->
    <template v-else>
      <p>Are you sure you want to create the assignment with the following details?</p>
      <p v-if="reviewerSelectionMode.mode !== 'session_user'" class="text-danger">
        <strong>Warning:</strong> The assignment process will make sure that a reviewer does not review their own document.
        <br>This could lead to a failure in the assignment process,
        <br>so make sure that the values are set correctly for a successful assignment.
      </p>
      <p v-else class="text-warning">
        <strong>Warning:</strong> In session user-based selection mode, each selected reviewer must have a corresponding study session.
        <br>
        <span v-if="unmatchedReviewersForSessions.length > 0" class="text-danger">
          The following reviewers do not have matching study sessions:
          <ul>
            <li v-for="unmatchedReviewer in unmatchedReviewersForSessions" :key="unmatchedReviewer.id">
              {{ unmatchedReviewer.firstName }} {{ unmatchedReviewer.lastName }} (ID: {{ unmatchedReviewer.id }})
            </li>
          </ul>
        </span>
        <span v-else>All selected reviewers have matching study sessions.</span>
      </p>
      <div class="container">
        <div class="row mb-2">
          <div class="col-2"><strong>Template:</strong></div>
          <div class="col-8">{{ template && template.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Workflow:</strong></div>
          <div class="col-8">{{ workflow && workflow.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Documents:</strong></div>
          <div class="col-8">{{ selectedAssignments.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Reviewers:</strong></div>
          <div class="col-8">{{ selectedReviewer.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Reviews to create:</strong></div>
          <div class="col-8">{{ numberOfReviews }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Selection Mode:</strong></div>
          <div class="col-8">
            {{ reviewerSelectionModeFields[0] && reviewerSelectionModeFields[0].options.find(f => f.value === reviewerSelectionMode.mode)?.name }}
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'role'" class="row mb-2">
          <div class="col-2"><strong>Roles:</strong></div>
          <div class="col-8">
            <ul>
              <li v-for="(value, key) in listOfSelectedRoles" :key="key">- {{ value.role }}: {{ value.value }}</li>
            </ul>
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'reviewer'" class="row mb-2">
          <div class="col-2"><strong>Reviewers:</strong></div>
          <div class="col-8">
            <ul>
              <li v-for="(value, key) in listOfSelectedReviewers" :key="key">- {{ value.reviewer }}: {{ value.value }}</li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: "ConfirmationStep",
  props: {
    variant: {
      type: String,
      required: true,
      validator: v => ['doc-sub-single', 'doc-sub-bulk', 'session-single', 'session-bulk'].includes(v),
    },
  },
  inject: {
    template: { type: Object, required: false, default: null },
    workflow: { type: Object, required: false, default: null },
    assignmentType: { type: String, required: false, default: 'document' },
    targetWorkflowId: { type: Number, required: false, default: null },
    selectedAssignments: { type: Array, required: false, default: () => [] },
    selectedReviewer: { type: Array, required: false, default: () => [] },
    reviewerSelectionMode: { type: Object, required: false, default: () => ({}) },
    workflowStepsAssignments: { type: Array, required: false, default: () => [] },
    numberOfReviews: { type: Number, required: false, default: 0 },
    reviewerSelectionModeFields: { type: Array, required: false, default: () => [] },
    reviewer: { type: Array, required: false, default: () => [] },
    documents: { type: Array, required: false, default: () => [] },
    roles: { type: Array, required: false, default: () => [] },
    roleSelection: { type: Object, required: false, default: () => ({}) },
    reviewerSelection: { type: Object, required: false, default: () => ({}) },
  },
  computed: {
    targetWorkflowName() {
      if (!this.targetWorkflowId) return 'Unknown';
      const workflow = this.$store.getters["table/workflow/get"](this.targetWorkflowId);
      return workflow ? workflow.name : "Unknown";
    },
    listOfSelectedRoles() {
      return Object.keys(this.roleSelection).map(key => {
        const role = this.roles.find(r => r.id === parseInt(key));
        return { role: role ? role.name : key, value: this.roleSelection[key] };
      });
    },
    listOfSelectedReviewers() {
      return Object.keys(this.reviewerSelection).map(key => {
        const user = this.reviewer.find(r => r.id === parseInt(key));
        return {
          reviewer: user ? `${user.firstName} ${user.lastName}` : key,
          value: this.reviewerSelection[key],
        };
      });
    },
    unmatchedReviewersForSessions() {
      if (this.assignmentType !== 'study_session' || this.reviewerSelectionMode.mode !== 'session_user') {
        return [];
      }
      const selectedSessionUserIds = new Set(
          this.selectedAssignments.map(session => {
            const studySession = this.$store.getters["table/study_session/get"](session.id);
            return studySession ? studySession.userId : null;
          }).filter(userId => userId !== null)
      );
      return this.selectedReviewer.filter(rev => !selectedSessionUserIds.has(rev.id));
    },
  },
};
</script>
