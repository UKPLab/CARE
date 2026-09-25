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
    <template v-else>
      <p>{{ $t('dashboard.study.createAssignmentConfirmPrompt') }}</p>
      <p v-if="reviewerSelectionMode.mode !== 'session_user'" class="text-danger">
        <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.notReviewOwnDocument') }}
        <br>{{ $t('dashboard.study.warning1') }}
        <br>{{ $t('dashboard.study.warning2') }}
      </p>
      <p v-else class="text-warning">
        <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.sessionUserSelectionWarning') }}
        <br>
        <span v-if="unmatchedReviewersForSessions.length > 0" class="text-danger">
          {{ $t('dashboard.study.reviewersWithoutMatchingStudySessions') }}
          <ul>
            <li v-for="unmatchedReviewer in unmatchedReviewersForSessions" :key="unmatchedReviewer.id">
              {{ unmatchedReviewer.firstName }} {{ unmatchedReviewer.lastName }}
              ({{ $t('common.id') }}: {{ unmatchedReviewer.id }})
            </li>
          </ul>
        </span>
        <span v-else>{{ $t('dashboard.study.allReviewersHaveMatchingStudySessions') }}</span>
      </p>
      <div class="container">
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.template') }}</strong></div>
          <div class="col-8">{{ template && template.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.workflow') }}</strong></div>
          <div class="col-8">{{ workflow && workflow.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.documents') }}</strong></div>
          <div class="col-8">{{ selectedAssignments.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
          <div class="col-8">{{ selectedReviewer.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.reviewsToCreate') }}</strong></div>
          <div class="col-8">{{ numberOfReviews }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.selectionMode') }}</strong></div>
          <div class="col-8">
            {{ reviewerSelectionModeFields[0] && reviewerSelectionModeFields[0].options.find(f => f.value === reviewerSelectionMode.mode)?.name }}
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'role'" class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.roles') }}</strong></div>
          <div class="col-8">
            <ul>
              <li v-for="(value, key) in listOfSelectedRoles" :key="key">- {{ value.role }}: {{ value.value }}</li>
            </ul>
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'reviewer'" class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
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
/**
 * Final confirmation step of the bulk assignment wizard. Displays a read-only summary
 * of all choices made in previous steps before the user submits the assignment.
 * Supports four variants: doc-sub-single, doc-sub-bulk, session-single, and session-bulk,
 * each rendering an appropriate summary layout. Also warns when reviewers lack matching
 * study sessions in session_user mode.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "ConfirmationStep",
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
  props: {
    variant: {
      type: String,
      required: true,
      validator: v => ['doc-sub-single', 'doc-sub-bulk', 'session-single', 'session-bulk'].includes(v),
    },
  },
  computed: {
    targetWorkflowName() {
      if (!this.targetWorkflowId) return this.$t("common.unknown");
      const workflow = this.$store.getters["table/workflow/get"](this.targetWorkflowId);
      return workflow ? workflow.name : this.$t("common.unknown");
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
  methods: {
    getDoc(documentId) {
      return this.documents.find(doc => doc.id === documentId);
    },
    getDocReviewerName(stepAssignment) {
      const doc = this.getDoc(stepAssignment.documentId);
      const user = doc ? this.reviewer.find(u => u.id === doc.userId) : null;
      return user ? `${user.firstName} ${user.lastName}` : '';
    },
  },
};
</script>
